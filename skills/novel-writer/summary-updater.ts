/**
 * Summary Updater - generates and updates chapter and global summaries
 */

import fs from 'fs';
import path from 'path';
import { estimateTokens } from './utils';

export class SummaryUpdater {
  private promptCache: Map<string, { mtimeMs: number; content: string }> = new Map();

  constructor(private skillRoot: string) {}

  /**
   * Build prompt for chapter summary generation
   */
  buildChapterSummaryPrompt(chapterContent: string, globalSummary: string): string {
    let template = this.getPrompt('generate-chapter-summary.md');
    template = template.replace('{{chapterContent}}', chapterContent);
    template = template.replace('{{globalSummary}}', globalSummary);
    return template;
  }

  /**
   * Build prompt for global summary update
   */
  buildGlobalSummaryUpdatePrompt(
    currentGlobalSummary: string,
    newChapterSummary: string,
    maxTokens: number
  ): string {
    let template = this.getPrompt('update-global-summary.md');
    template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary);
    template = template.replace('{{newChapterSummary}}', newChapterSummary);
    template = template.replace('{{maxTokens}}', maxTokens.toString());
    return template;
  }

  /**
   * Build prompt for character relationships update
   */
  buildCharacterRelationshipsUpdatePrompt(
    currentRelationships: string,
    currentGlobalSummary: string,
    newChapterSummary: string
  ): string {
    let template = this.getPrompt('update-character-relationships.md');
    template = template.replace('{{currentRelationships}}', currentRelationships || '(暂无)');
    template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary || '(暂无)');
    template = template.replace('{{newChapterSummary}}', newChapterSummary);
    return template;
  }

  /**
   * Build prompt for timeline update
   */
  buildTimelineUpdatePrompt(
    currentTimeline: string,
    currentGlobalSummary: string,
    newChapterSummary: string
  ): string {
    let template = this.getPrompt('update-timeline.md');
    template = template.replace('{{currentTimeline}}', currentTimeline || '(暂无)');
    template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary || '(暂无)');
    template = template.replace('{{newChapterSummary}}', newChapterSummary);
    return template;
  }

  /**
   * Build prompt for chapter plan update
   */
  buildChapterPlanUpdatePrompt(
    currentPlan: string,
    chapterNumber: number,
    chapterTitle: string,
    newChapterSummary: string
  ): string {
    let template = this.getPrompt('update-chapter-plan.md');
    template = template.replace('{{currentPlan}}', currentPlan || '(暂无)');
    template = template.replace('{{chapterNumber}}', chapterNumber.toString());
    template = template.replace('{{chapterTitle}}', chapterTitle || '待定');
    template = template.replace('{{newChapterSummary}}', newChapterSummary);
    return template;
  }

  /**
   * Build prompt for character card update
   */
  buildCharacterCardUpdatePrompt(
    characterName: string,
    currentCard: string,
    currentGlobalSummary: string,
    newChapterSummary: string
  ): string {
    let template = this.getPrompt('update-character-card.md');
    template = template.replace('{{characterName}}', characterName);
    template = template.replace('{{currentCard}}', currentCard || '(暂无)');
    template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary || '(暂无)');
    template = template.replace('{{newChapterSummary}}', newChapterSummary);
    return template;
  }

  /**
   * Build prompt for rebuilding project state from existing chapter summaries
   */
  buildRebuildProjectStatePrompt(
    chapterSummaries: string,
    currentGlobalSummary: string,
    currentRelationships: string,
    maxTokens: number
  ): string {
    let template = this.getPrompt('rebuild-project-state.md');
    template = template.replace('{{chapterSummaries}}', chapterSummaries);
    template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary || '(暂无)');
    template = template.replace('{{currentRelationships}}', currentRelationships || '(暂无)');
    template = template.replace('{{maxTokens}}', maxTokens.toString());
    return template;
  }

  /**
   * Build prompt for distilling a raw style material into a style card
   */
  buildStyleCardPrompt(category: string, title: string, rawMaterial: string): string {
    let template = this.getPrompt('analyze-style-material.md');
    template = template.replace('{{category}}', category);
    template = template.replace('{{title}}', title);
    template = template.replace('{{rawMaterial}}', rawMaterial);
    return template;
  }

  /**
   * Build prompt for global summary compression
   */
  buildCompressPrompt(originalSummary: string, targetTokens: number): string {
    let template = this.getPrompt('compress-global-summary.md');
    template = template.replace('{{originalSummary}}', originalSummary);
    template = template.replace('{{targetTokens}}', targetTokens.toString());
    return template;
  }

  /**
   * Build prompt for content expansion
   */
  buildExpandPrompt(formattedContext: string): string {
    let template = this.getPrompt('expand-content.md');
    template = template.replace('{{context}}', formattedContext);
    return template;
  }

  /**
   * Build prompt for consistency checking
   */
  buildConsistencyCheckPrompt(
    formattedContext: string,
    chapterContent: string
  ): string {
    let template = this.getPrompt('consistency-check.md');
    template = template.replace('{{context}}', formattedContext);
    template = template.replace('{{chapterContent}}', chapterContent);
    return template;
  }

  /**
   * Build prompt for chapter range review
   */
  buildArcReviewPrompt(
    chapterRangeLabel: string,
    globalSummary: string,
    timeline: string,
    chapterPlan: string,
    chapterSummaries: string
  ): string {
    let template = this.getPrompt('review-arc.md');
    template = template.replace('{{chapterRangeLabel}}', chapterRangeLabel);
    template = template.replace('{{globalSummary}}', globalSummary || '(暂无)');
    template = template.replace('{{timeline}}', timeline || '(暂无)');
    template = template.replace('{{chapterPlan}}', chapterPlan || '(暂无)');
    template = template.replace('{{chapterSummaries}}', chapterSummaries || '(暂无)');
    return template;
  }

  /**
   * Build prompt for next chapter planning
   */
  buildNextChapterPlanningPrompt(
    targetChapter: number,
    globalSummary: string,
    timeline: string,
    chapterPlan: string,
    chapterSummaries: string,
    userIntent: string
  ): string {
    let template = this.getPrompt('plan-next-chapter.md');
    template = template.replace('{{targetChapter}}', targetChapter.toString());
    template = template.replace('{{globalSummary}}', globalSummary || '(暂无)');
    template = template.replace('{{timeline}}', timeline || '(暂无)');
    template = template.replace('{{chapterPlan}}', chapterPlan || '(暂无)');
    template = template.replace('{{chapterSummaries}}', chapterSummaries || '(暂无)');
    template = template.replace('{{userIntent}}', userIntent || '(暂无额外要求)');
    return template;
  }

  /**
   * Check if global summary needs compression
   */
  needsCompression(summary: string, maxTokens: number): boolean {
    const tokens = estimateTokens(summary);
    return tokens > maxTokens;
  }

  /**
   * Get prompt template from cache or file
   */
  private getPrompt(name: string): string {
    const candidatePaths = [
      path.join(process.cwd(), 'skills', 'novel-writer', 'prompts', name),
      path.join(this.skillRoot, 'prompts', name),
      path.resolve(this.skillRoot, '..', '..', 'skills', 'novel-writer', 'prompts', name),
    ];
    const filePath = candidatePaths.find(candidate => fs.existsSync(candidate));

    if (!filePath) {
      throw new Error(`Prompt template not found: ${name}`);
    }

    const stats = fs.statSync(filePath);
    const cached = this.promptCache.get(filePath);
    if (cached && cached.mtimeMs === stats.mtimeMs) {
      return cached.content;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    this.promptCache.set(filePath, {
      mtimeMs: stats.mtimeMs,
      content,
    });
    return content;
  }
}
