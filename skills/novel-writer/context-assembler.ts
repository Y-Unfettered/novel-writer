/**
 * Context Assembler - assembles context from different layers with token budgeting
 */

import { AssembledContext, ContextOptions, DEFAULT_TOKEN_BUDGET, NovelProject } from './types';
import { ProjectManager } from './project-manager';
import { estimateTokens } from './utils';

export class ContextAssembler {
  private static readonly EXCERPT_SAFETY_BUFFER_TOKENS = 16;

  constructor(private projectManager: ProjectManager) {}

  async assembleContext(
    project: NovelProject,
    targetChapter: number,
    userPrompt: string,
    options?: ContextOptions
  ): Promise<AssembledContext> {
    const parsedStyleRequest = this.extractStyleRequest(userPrompt);
    const cleanedPrompt = parsedStyleRequest.cleanedPrompt;

    const config = {
      maxContextTokens: options?.maxContextTokens ?? project.config.maxContextTokens,
      maxCharacterCards: options?.maxCharacterCards ?? project.config.maxCharacterCards,
      maxRecentFullChapters: options?.maxRecentFullChapters ?? project.config.maxRecentFullChapters,
      maxRecentChapterSummaries: options?.maxRecentChapterSummaries ?? project.config.maxRecentChapterSummaries,
      maxStyleReferences: options?.maxStyleReferences ?? project.config.maxStyleReferences,
    };

    const [globalSummary, timeline, chapterPlan] = await Promise.all([
      this.projectManager.readGlobalSummary(project),
      this.projectManager.readTimeline(project),
      this.projectManager.readChapterPlan(project),
    ]);

    const recentFullChapters = this.projectManager.getLastNChapters(
      project,
      config.maxRecentFullChapters,
      targetChapter
    );
    const recentSummaryChapters = this.projectManager.getLastNChapters(
      project,
      config.maxRecentChapterSummaries,
      targetChapter
    );

    const recentChapterSummaries = await Promise.all(
      recentSummaryChapters
        .filter(chapter => !recentFullChapters.find(item => item.number === chapter.number))
        .map(async chapter => ({
          number: chapter.number,
          summary: (await this.projectManager.readChapterSummary(chapter)).trim(),
        }))
    );

    const filteredSummaries = recentChapterSummaries.filter(item => item.summary);

    const recentFullContents = await Promise.all(
      recentFullChapters.map(async chapter => ({
        number: chapter.number,
        content: this.stripChapterTitle(await this.projectManager.readChapterContent(chapter)),
      }))
    );

    const [styleReferences, characterCards] = await Promise.all([
      this.selectStyleReferences(project, parsedStyleRequest.categories, config.maxStyleReferences),
      this.selectCharacterCards(
        project,
        `${globalSummary}\n${cleanedPrompt}\n${recentFullContents.map(item => item.content).join('\n')}`,
        config.maxCharacterCards
      ),
    ]);

    const context: AssembledContext = {
      globalSummary,
      timeline,
      chapterPlan,
      characterCards,
      recentChapterSummaries: filteredSummaries,
      recentFullContents,
      styleReferences,
      userPrompt: cleanedPrompt,
      estimatedTokens: 0,
    };

    const withTokens = this.recalculateEstimatedTokens(context);
    const maxTokens = Math.max(config.maxContextTokens, 0) || DEFAULT_TOKEN_BUDGET.total;
    return this.trimContextIfNeeded(withTokens, maxTokens);
  }

  async trimContextIfNeeded(context: AssembledContext, maxTokens: number): Promise<AssembledContext> {
    let trimmed: AssembledContext = this.recalculateEstimatedTokens({
      ...context,
      characterCards: [...context.characterCards],
      recentChapterSummaries: [...context.recentChapterSummaries],
      recentFullContents: [...context.recentFullContents],
      styleReferences: [...context.styleReferences],
    });

    if (trimmed.estimatedTokens <= maxTokens) {
      return trimmed;
    }

    while (trimmed.recentFullContents.length > 1 && trimmed.estimatedTokens > maxTokens) {
      trimmed.recentFullContents.shift();
      trimmed = this.recalculateEstimatedTokens(trimmed);
    }
    if (trimmed.estimatedTokens <= maxTokens) {
      return trimmed;
    }

    while (trimmed.recentChapterSummaries.length > 1 && trimmed.estimatedTokens > maxTokens) {
      trimmed.recentChapterSummaries.shift();
      trimmed = this.recalculateEstimatedTokens(trimmed);
    }
    if (trimmed.estimatedTokens <= maxTokens) {
      return trimmed;
    }

    while (trimmed.styleReferences.length > 0 && trimmed.estimatedTokens > maxTokens) {
      trimmed.styleReferences.pop();
      trimmed = this.recalculateEstimatedTokens(trimmed);
    }
    if (trimmed.estimatedTokens <= maxTokens) {
      return trimmed;
    }

    while (trimmed.characterCards.length > 0 && trimmed.estimatedTokens > maxTokens) {
      trimmed.characterCards.pop();
      trimmed = this.recalculateEstimatedTokens(trimmed);
    }
    if (trimmed.estimatedTokens <= maxTokens) {
      return trimmed;
    }

    if (trimmed.recentFullContents.length === 1 && trimmed.estimatedTokens > maxTokens) {
      const baseTokens = this.calculateEstimatedTokens(
        trimmed.globalSummary,
        trimmed.timeline,
        trimmed.chapterPlan,
        trimmed.characterCards,
        trimmed.recentChapterSummaries,
        [],
        trimmed.styleReferences,
        trimmed.userPrompt
      );
      const availableTokens = maxTokens - baseTokens;

      if (availableTokens <= 0) {
        trimmed.recentFullContents = [];
      } else {
        const onlyChapter = trimmed.recentFullContents[0];
        trimmed.recentFullContents = [{
          ...onlyChapter,
          content: this.buildTailExcerpt(
            onlyChapter.content,
            availableTokens,
            '以下为上一章结尾节选，前文因上下文预算被省略。'
          ),
        }];
      }

      trimmed = this.recalculateEstimatedTokens(trimmed);
    }
    if (trimmed.estimatedTokens <= maxTokens) {
      return trimmed;
    }

    if (trimmed.recentChapterSummaries.length === 1 && trimmed.estimatedTokens > maxTokens) {
      const baseTokens = this.calculateEstimatedTokens(
        trimmed.globalSummary,
        trimmed.timeline,
        trimmed.chapterPlan,
        trimmed.characterCards,
        [],
        trimmed.recentFullContents,
        trimmed.styleReferences,
        trimmed.userPrompt
      );
      const availableTokens = maxTokens - baseTokens;

      if (availableTokens <= 0) {
        trimmed.recentChapterSummaries = [];
      } else {
        const onlySummary = trimmed.recentChapterSummaries[0];
        trimmed.recentChapterSummaries = [{
          ...onlySummary,
          summary: this.buildTailExcerpt(
            onlySummary.summary,
            availableTokens,
            '以下为上一章摘要压缩版。'
          ),
        }];
      }

      trimmed = this.recalculateEstimatedTokens(trimmed);
    }

    return trimmed;
  }

  formatContextForPrompt(context: AssembledContext): string {
    const parts: string[] = [];

    if (context.globalSummary.trim()) {
      parts.push('--- 全局设定与主线进展 ---\n\n' + context.globalSummary.trim());
    }

    if (context.chapterPlan.trim()) {
      parts.push('--- 章节计划板 ---\n\n' + context.chapterPlan.trim());
    }

    if (context.timeline.trim()) {
      parts.push('--- 时间线 ---\n\n' + context.timeline.trim());
    }

    if (context.characterCards.length > 0) {
      parts.push(
        '--- 相关角色卡 ---\n\n' +
          context.characterCards.map(card => `**${card.name}**:\n${card.content.trim()}`).join('\n\n')
      );
    }

    if (context.recentChapterSummaries.length > 0) {
      parts.push(
        '--- 最近章节摘要 ---\n\n' +
          context.recentChapterSummaries.map(item => `**第${item.number}章摘要**:\n${item.summary}`).join('\n\n')
      );
    }

    if (context.recentFullContents.length > 0) {
      parts.push(
        '--- 最近完整内容 ---\n\n' +
          context.recentFullContents.map(item => `**第${item.number}章内容**:\n\n${item.content}`).join('\n\n')
      );
    }

    if (context.styleReferences.length > 0) {
      parts.push(
        '--- 风格参考卡（仅借鉴写法，不直接模仿原文） ---\n\n' +
          context.styleReferences.map(ref => `**${ref.category} / ${ref.name}**:\n${ref.content.trim()}`).join('\n\n')
      );
    }

    if (context.userPrompt.trim()) {
      parts.push('--- 本章要点 ---\n\n' + context.userPrompt.trim());
    }

    return parts.join('\n\n');
  }

  private calculateEstimatedTokens(
    globalSummary: string,
    timeline: string,
    chapterPlan: string,
    characterCards: Array<{ name: string; content: string }>,
    recentChapterSummaries: Array<{ number: number; summary: string }>,
    recentFullContents: Array<{ number: number; content: string }>,
    styleReferences: Array<{ category: string; name: string; content: string }>,
    userPrompt: string
  ): number {
    let total = estimateTokens(globalSummary);
    total += estimateTokens(timeline);
    total += estimateTokens(chapterPlan);
    total += estimateTokens(userPrompt);

    for (const card of characterCards) {
      total += estimateTokens(card.content);
    }

    for (const summary of recentChapterSummaries) {
      total += estimateTokens(summary.summary);
    }

    for (const chapter of recentFullContents) {
      total += estimateTokens(chapter.content);
    }

    for (const styleReference of styleReferences) {
      total += estimateTokens(styleReference.content);
    }

    total += 200;
    return total;
  }

  private recalculateEstimatedTokens(context: AssembledContext): AssembledContext {
    return {
      ...context,
      estimatedTokens: this.calculateEstimatedTokens(
        context.globalSummary,
        context.timeline,
        context.chapterPlan,
        context.characterCards,
        context.recentChapterSummaries,
        context.recentFullContents,
        context.styleReferences,
        context.userPrompt
      ),
    };
  }

  private buildTailExcerpt(content: string, maxTokens: number, note: string): string {
    const normalizedContent = content.trim();
    if (maxTokens <= 0) {
      return '';
    }

    const noteBlock = `[${note}]`;
    const noteTokens = estimateTokens(noteBlock);
    if (noteTokens >= maxTokens) {
      return this.sliceFromEnd(noteBlock, maxTokens);
    }

    const availableTokens = Math.max(
      maxTokens - noteTokens - ContextAssembler.EXCERPT_SAFETY_BUFFER_TOKENS,
      0
    );
    const excerpt = this.sliceFromEnd(normalizedContent, availableTokens);
    return `${noteBlock}\n\n${excerpt}`.trim();
  }

  private sliceFromEnd(text: string, maxTokens: number): string {
    if (!text.trim() || maxTokens <= 0) {
      return '';
    }

    const approxChars = Math.max(Math.floor(maxTokens * 1.5), 1);
    if (text.length <= approxChars) {
      return text.trim();
    }

    return text.slice(-approxChars).trim();
  }

  private stripChapterTitle(content: string): string {
    const lines = content.trim().split('\n');
    if (lines[0]?.startsWith('#')) {
      return lines.slice(1).join('\n').trim();
    }
    return content.trim();
  }

  private extractStyleRequest(userPrompt: string): { categories: string[]; cleanedPrompt: string } {
    const match = userPrompt.match(/调用风格[:：]\s*([^\n]+)/);
    if (!match) {
      return { categories: [], cleanedPrompt: userPrompt.trim() };
    }

    const categories = match[1]
      .split(/[，、,]/)
      .map(item => item.trim())
      .filter(Boolean);

    return {
      categories,
      cleanedPrompt: userPrompt.replace(match[0], '').trim(),
    };
  }

  private async selectStyleReferences(
    project: NovelProject,
    categories: string[],
    maxStyleReferences: number
  ): Promise<Array<{ category: string; name: string; content: string }>> {
    if (categories.length === 0 || maxStyleReferences <= 0) {
      return [];
    }

    const allCards = await this.projectManager.readStyleReferenceCards(project);
    const normalizedCategories = categories.map(category => category.toLowerCase());

    return allCards
      .filter(card => normalizedCategories.some(category => card.category.toLowerCase().includes(category)))
      .slice(0, maxStyleReferences)
      .map(card => ({
        category: card.category,
        name: card.name,
        content: card.content,
      }));
  }

  private async selectCharacterCards(
    project: NovelProject,
    relevanceSource: string,
    maxCards: number
  ): Promise<Array<{ name: string; content: string }>> {
    if (maxCards <= 0) {
      return [];
    }

    const allCards = await this.projectManager.readCharacterCards(project);
    if (allCards.length === 0) {
      return [];
    }

    const normalizedSource = relevanceSource.toLowerCase();
    return allCards
      .map(card => ({
        ...card,
        score: normalizedSource.includes(card.name.toLowerCase()) ? 1 : 0,
      }))
      .filter(card => card.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
      .slice(0, maxCards)
      .map(card => ({
        name: card.name,
        content: card.content,
      }));
  }
}
