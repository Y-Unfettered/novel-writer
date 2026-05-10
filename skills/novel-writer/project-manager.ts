/**
 * Project Manager - handles project creation, loading, saving
 */

import fs from 'fs';
import path from 'path';
import { ChapterInfo, ChapterPlanEntry, DEFAULT_CONFIG, NovelProject } from './types';
import { countWords, ensureDir, formatChapterNumber, readFile, writeFile } from './utils';

export class ProjectManager {
  async createNewProject(
    title: string,
    author: string,
    rootPath: string,
    basicSetting: string
  ): Promise<NovelProject> {
    const now = Date.now();
    const project: NovelProject = {
      title,
      author,
      rootPath,
      createdAt: now,
      updatedAt: now,
      totalChapters: 0,
      currentChapter: 0,
      config: { ...DEFAULT_CONFIG },
      chapters: [],
    };

    await ensureDir(rootPath);
    await ensureDir(path.join(rootPath, 'chapters'));
    await ensureDir(path.join(rootPath, 'chapters', 'drafts'));
    await ensureDir(path.join(rootPath, 'characters'));
    await ensureDir(path.join(rootPath, 'characters', 'cards'));
    await ensureDir(path.join(rootPath, 'planning'));
    await ensureDir(path.join(rootPath, 'references', 'raw'));
    await ensureDir(path.join(rootPath, 'references', 'cards'));

    await writeFile(path.join(rootPath, 'global-summary.md'), this.buildInitialGlobalSummary(title, basicSetting));
    await writeFile(path.join(rootPath, 'characters', '人物关系.md'), this.buildInitialCharacterRelationships());
    await writeFile(path.join(rootPath, 'characters', 'cards', 'README.md'), this.buildInitialCharacterCardGuide());
    await writeFile(path.join(rootPath, 'planning', 'timeline.md'), this.buildInitialTimeline());

    const chapterPlanEntries = this.buildInitialChapterPlanEntries();
    await writeFile(path.join(rootPath, 'planning', 'chapter-plan.md'), this.renderChapterPlanMarkdown(chapterPlanEntries));
    await writeFile(
      path.join(rootPath, 'planning', 'chapter-plan.json'),
      JSON.stringify(chapterPlanEntries, null, 2) + '\n'
    );
    await writeFile(path.join(rootPath, 'references', 'cards', 'README.md'), this.buildInitialStyleReferenceGuide());

    await this.saveProject(project);
    return project;
  }

  async loadProject(projectPath: string): Promise<NovelProject> {
    const novelJsonPath = path.join(projectPath, 'novel.json');
    if (!fs.existsSync(novelJsonPath)) {
      throw new Error(`Not a valid novel project: ${projectPath} (no novel.json)`);
    }

    const content = await readFile(novelJsonPath);
    const project = JSON.parse(content) as NovelProject;
    return this.normalizeLoadedProject(projectPath, project);
  }

  async saveProject(project: NovelProject): Promise<void> {
    project.updatedAt = Date.now();
    const novelJsonPath = path.join(project.rootPath, 'novel.json');
    await writeFile(novelJsonPath, JSON.stringify(this.toStoredProject(project), null, 2));
  }

  async saveChapter(
    project: NovelProject,
    chapterNumber: number,
    chapterTitle: string,
    content: string
  ): Promise<ChapterInfo> {
    const formattedNum = formatChapterNumber(chapterNumber);
    const contentPath = path.join(project.rootPath, 'chapters', `${formattedNum}.md`);
    const summaryPath = path.join(project.rootPath, 'chapters', `${formattedNum}-summary.md`);
    const existingIndex = project.chapters.findIndex(chapter => chapter.number === chapterNumber);
    const now = Date.now();

    const chapterInfo: ChapterInfo = {
      number: chapterNumber,
      title: chapterTitle,
      contentPath,
      summaryPath,
      wordCount: countWords(content),
      createdAt: existingIndex >= 0 ? project.chapters[existingIndex].createdAt : now,
      updatedAt: now,
    };

    await writeFile(contentPath, this.wrapChapterContent(chapterNumber, chapterTitle, content));

    if (existingIndex >= 0) {
      project.chapters[existingIndex] = chapterInfo;
    } else {
      project.chapters.push(chapterInfo);
      project.chapters.sort((a, b) => a.number - b.number);
    }

    project.totalChapters = project.chapters.length;
    if (chapterNumber > project.currentChapter) {
      project.currentChapter = chapterNumber;
    }

    await this.saveProject(project);
    return chapterInfo;
  }

  async saveChapterDraft(
    project: NovelProject,
    chapterNumber: number,
    chapterTitle: string,
    content: string
  ): Promise<string> {
    const formattedNum = formatChapterNumber(chapterNumber);
    const draftsDir = path.join(project.rootPath, 'chapters', 'drafts');
    const draftPath = path.join(draftsDir, `${formattedNum}-draft.md`);
    await ensureDir(draftsDir);
    await writeFile(draftPath, this.wrapChapterContent(chapterNumber, chapterTitle, content));
    return draftPath;
  }

  async readChapterContent(chapter: ChapterInfo): Promise<string> {
    return readFile(chapter.contentPath);
  }

  async readChapterSummary(chapter: ChapterInfo): Promise<string> {
    if (!fs.existsSync(chapter.summaryPath)) {
      return '';
    }
    return readFile(chapter.summaryPath);
  }

  async saveChapterSummary(chapter: ChapterInfo, summary: string): Promise<void> {
    await writeFile(chapter.summaryPath, summary);
  }

  async readGlobalSummary(project: NovelProject): Promise<string> {
    const filePath = path.join(project.rootPath, 'global-summary.md');
    return fs.existsSync(filePath) ? readFile(filePath) : '';
  }

  async saveGlobalSummary(project: NovelProject, summary: string): Promise<void> {
    await writeFile(path.join(project.rootPath, 'global-summary.md'), summary);
  }

  async readCharacterRelationships(project: NovelProject): Promise<string> {
    const filePath = path.join(project.rootPath, 'characters', '人物关系.md');
    return fs.existsSync(filePath) ? readFile(filePath) : '';
  }

  async saveCharacterRelationships(project: NovelProject, content: string): Promise<void> {
    await writeFile(path.join(project.rootPath, 'characters', '人物关系.md'), content);
  }

  async readTimeline(project: NovelProject): Promise<string> {
    const filePath = path.join(project.rootPath, 'planning', 'timeline.md');
    return fs.existsSync(filePath) ? readFile(filePath) : '';
  }

  async saveTimeline(project: NovelProject, content: string): Promise<void> {
    await writeFile(path.join(project.rootPath, 'planning', 'timeline.md'), content);
  }

  async readChapterPlan(project: NovelProject): Promise<string> {
    const filePath = path.join(project.rootPath, 'planning', 'chapter-plan.md');
    return fs.existsSync(filePath) ? readFile(filePath) : '';
  }

  async saveChapterPlan(project: NovelProject, content: string): Promise<void> {
    await writeFile(path.join(project.rootPath, 'planning', 'chapter-plan.md'), content);
    const parsedEntries = this.parseChapterPlanMarkdown(content);
    if (parsedEntries.length > 0) {
      await this.saveChapterPlanEntries(project, parsedEntries);
    }
  }

  async upsertChapterPlanEntry(
    project: NovelProject,
    entry: {
      chapterNumber: number;
      title?: string;
      status?: string;
      goal?: string;
      conflict?: string;
      note?: string;
    }
  ): Promise<void> {
    const entries = await this.readChapterPlanEntries(project);
    const existingIndex = entries.findIndex(item => item.chapterNumber === entry.chapterNumber);
    const nextEntry = this.mergeChapterPlanEntry(
      existingIndex >= 0 ? entries[existingIndex] : this.createDefaultChapterPlanEntry(entry.chapterNumber),
      entry
    );

    if (existingIndex >= 0) {
      entries[existingIndex] = nextEntry;
    } else {
      entries.push(nextEntry);
      entries.sort((a, b) => a.chapterNumber - b.chapterNumber);
    }

    await this.saveChapterPlanEntries(project, entries);
    await writeFile(path.join(project.rootPath, 'planning', 'chapter-plan.md'), this.renderChapterPlanMarkdown(entries));
  }

  async saveCharacterCard(project: NovelProject, name: string, content: string): Promise<string> {
    const fileName = `${this.sanitizeFileName(name)}.md`;
    const filePath = path.join(project.rootPath, 'characters', 'cards', fileName);
    await writeFile(filePath, this.wrapCharacterCardContent(name, content));
    return filePath;
  }

  async readCharacterCards(project: NovelProject): Promise<Array<{ name: string; content: string; path: string }>> {
    const dirPath = path.join(project.rootPath, 'characters', 'cards');
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    const cards: Array<{ name: string; content: string; path: string }> = [];
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      const rawContent = await readFile(filePath);
      const parsed = this.parseCharacterCardContent(rawContent);
      cards.push({
        name: parsed?.name ?? file.name.replace(/\.md$/i, '').replace(/_/g, ' '),
        content: parsed?.content ?? rawContent.trim(),
        path: filePath,
      });
    }

    return cards;
  }

  async saveStyleReferenceRaw(
    project: NovelProject,
    category: string,
    name: string,
    content: string
  ): Promise<string> {
    const fileName = this.buildStyleReferenceFileName(category, name);
    const filePath = path.join(project.rootPath, 'references', 'raw', fileName);
    await writeFile(filePath, this.wrapStyleReferenceContent(category, name, content));
    return filePath;
  }

  async saveStyleReferenceCard(
    project: NovelProject,
    category: string,
    name: string,
    content: string
  ): Promise<string> {
    const fileName = this.buildStyleReferenceFileName(category, name);
    const filePath = path.join(project.rootPath, 'references', 'cards', fileName);
    await writeFile(filePath, this.wrapStyleReferenceContent(category, name, content));
    return filePath;
  }

  async createProjectSnapshot(project: NovelProject, label?: string): Promise<string> {
    const timestamp = this.buildSnapshotTimestamp();
    const safeLabel = label?.trim() ? `-${this.sanitizeFileName(label.trim())}` : '';
    const snapshotRoot = path.join(project.rootPath, 'snapshots', `${timestamp}${safeLabel}`);
    await ensureDir(snapshotRoot);

    const targets = ['novel.json', 'global-summary.md', 'chapters', 'characters', 'planning', 'references'];
    for (const target of targets) {
      const sourcePath = path.join(project.rootPath, target);
      if (!fs.existsSync(sourcePath)) {
        continue;
      }
      await this.copySnapshotItem(sourcePath, path.join(snapshotRoot, target));
    }

    await writeFile(
      path.join(snapshotRoot, 'SNAPSHOT.md'),
      `# Snapshot\n\n- createdAt: ${new Date().toISOString()}\n- title: ${project.title}\n- currentChapter: ${project.currentChapter}\n`
    );

    return snapshotRoot;
  }

  async readStyleReferenceCards(project: NovelProject): Promise<Array<{ category: string; name: string; content: string; path: string }>> {
    return this.readStyleReferenceDirectory(path.join(project.rootPath, 'references', 'cards'), true);
  }

  async readStyleReferenceRawMaterials(project: NovelProject): Promise<Array<{ category: string; name: string; content: string; path: string }>> {
    return this.readStyleReferenceDirectory(path.join(project.rootPath, 'references', 'raw'), false);
  }

  getChapter(project: NovelProject, number: number): ChapterInfo | undefined {
    return project.chapters.find(chapter => chapter.number === number);
  }

  getSortedChapters(project: NovelProject): ChapterInfo[] {
    return [...project.chapters].sort((a, b) => a.number - b.number);
  }

  getLastNChapters(project: NovelProject, n: number, beforeChapter?: number): ChapterInfo[] {
    const sorted = this.getSortedChapters(project);
    if (beforeChapter !== undefined) {
      return sorted.filter(chapter => chapter.number < beforeChapter).slice(-n);
    }
    return sorted.slice(-n);
  }

  private buildInitialGlobalSummary(title: string, setting: string): string {
    return `# ${title} - 全局摘要

## 世界观设定

${setting}

## 主要人物

(暂无)

## 主线进展

(尚未开始)

## 活跃伏笔

(暂无)

## 已完结情节

(暂无)
`;
  }

  private buildInitialCharacterRelationships(): string {
    return `# 人物关系

## 主要人物

(暂无)

## 人物关系

(暂无)

## 阵营与立场

(暂无)

## 当前状态

(暂无)

## 重要物品与线索归属

(暂无)
`;
  }

  private buildInitialCharacterCardGuide(): string {
    return `# 角色卡说明

这里用于存放单个角色的独立卡片，适合维护长篇中的人物状态。

建议每张角色卡至少包含：
- 角色身份与外显标签
- 首次出场章节
- 当前立场与目标
- 与主要人物的关系
- 当前状态（受伤、失踪、掌握的秘密等）
- 重要物品/线索归属
- 不能写错的设定
`;
  }

  private buildInitialTimeline(): string {
    return `# 时间线

## 远期背景

(暂无)

## 当前故事时间线

| 序号 | 时间/时段 | 章节 | 地点 | 事件 | 涉及人物 |
| --- | --- | --- | --- | --- | --- |
| 1 | 待定 | 待定 | 待定 | (暂无) | (暂无) |
`;
  }

  private buildInitialChapterPlanEntries(): ChapterPlanEntry[] {
    return [this.createDefaultChapterPlanEntry(1)];
  }

  private createDefaultChapterPlanEntry(chapterNumber: number): ChapterPlanEntry {
    return {
      chapterNumber,
      title: '待定',
      status: '待写',
      goal: '(暂无)',
      conflict: '(暂无)',
      note: '(暂无)',
    };
  }

  private buildInitialChapterPlan(): string {
    return this.renderChapterPlanMarkdown(this.buildInitialChapterPlanEntries());
  }

  private renderChapterPlanMarkdown(entries: ChapterPlanEntry[]): string {
    const rows = entries
      .slice()
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
      .map(entry => `| ${entry.chapterNumber} | ${entry.title} | ${entry.status} | ${entry.goal} | ${entry.conflict} | ${entry.note} |`)
      .join('\n');

    return `# 章节计划板

| 章节 | 标题 | 状态 | 本章目标 | 关键冲突 | 备注 |
| --- | --- | --- | --- | --- | --- |
${rows}

状态建议：待写 / 草稿 / 已成稿 / 已更新摘要 / 已定稿
`;
  }

  private buildInitialStyleReferenceGuide(): string {
    return `# 风格参考库说明

这里存放你自己的参考写法卡片，而不是直接把长篇原文塞进上下文。

建议流程：
1. 把喜欢的环境描写、人物描写、打斗描写原文放进 references/raw
2. 提炼成短小的“风格卡”放进 references/cards
3. 写作时在要点里写：调用风格：环境,人物,打斗

风格卡建议包含：适用场景、节奏特点、句式特点、感官重点、禁忌、可借鉴技巧。
`;
  }

  private sanitizeFileName(input: string): string {
    return input.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/--+/g, '_').replace(/\s+/g, '_');
  }

  private parseStyleReferenceFileName(fileName: string): { category: string; name: string } {
    const baseName = fileName.replace(/\.md$/i, '');
    const separator = baseName.includes('--') ? '--' : '-';
    const splitIndex = baseName.indexOf(separator);
    if (splitIndex < 0) {
      return { category: '未分类', name: baseName };
    }

    return {
      category: baseName.slice(0, splitIndex).replace(/_/g, ' '),
      name: baseName.slice(splitIndex + separator.length).replace(/_/g, ' '),
    };
  }

  private wrapChapterContent(number: number, title: string, content: string): string {
    const heading = title.trim() ? `# 第${number}章 ${title.trim()}` : `# 第${number}章`;
    return `${heading}\n\n${content.trim()}\n`;
  }

  private wrapCharacterCardContent(name: string, content: string): string {
    const metadata = JSON.stringify({ name });
    return `<!-- novel-character-meta: ${metadata} -->\n${content.trim()}\n`;
  }

  private buildSnapshotTimestamp(): string {
    const now = new Date();
    const parts = [
      now.getFullYear(),
      `${now.getMonth() + 1}`.padStart(2, '0'),
      `${now.getDate()}`.padStart(2, '0'),
      `${now.getHours()}`.padStart(2, '0'),
      `${now.getMinutes()}`.padStart(2, '0'),
      `${now.getSeconds()}`.padStart(2, '0'),
    ];
    return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`;
  }

  private async copySnapshotItem(sourcePath: string, destinationPath: string): Promise<void> {
    const stat = await fs.promises.stat(sourcePath);
    if (stat.isDirectory()) {
      await ensureDir(destinationPath);
      const entries = await fs.promises.readdir(sourcePath, { withFileTypes: true });
      for (const entry of entries) {
        await this.copySnapshotItem(path.join(sourcePath, entry.name), path.join(destinationPath, entry.name));
      }
      return;
    }

    await ensureDir(path.dirname(destinationPath));
    await fs.promises.copyFile(sourcePath, destinationPath);
  }

  private normalizeLoadedProject(projectPath: string, project: NovelProject): NovelProject {
    const storedRootPath = project.rootPath;

    return {
      ...project,
      rootPath: projectPath,
      config: {
        ...DEFAULT_CONFIG,
        ...(project.config ?? {}),
      },
      chapters: (project.chapters ?? []).map(chapter => ({
        ...chapter,
        contentPath: this.rebaseStoredPath(projectPath, storedRootPath, chapter.contentPath),
        summaryPath: this.rebaseStoredPath(projectPath, storedRootPath, chapter.summaryPath),
      })),
    };
  }

  private toStoredProject(project: NovelProject): NovelProject {
    return {
      ...project,
      config: {
        ...DEFAULT_CONFIG,
        ...(project.config ?? {}),
      },
      rootPath: '.',
      chapters: project.chapters.map(chapter => ({
        ...chapter,
        contentPath: path.relative(project.rootPath, chapter.contentPath),
        summaryPath: path.relative(project.rootPath, chapter.summaryPath),
      })),
    };
  }

  private rebaseStoredPath(currentRootPath: string, storedRootPath: string, filePath: string): string {
    if (!filePath) {
      return filePath;
    }

    if (!path.isAbsolute(filePath)) {
      return path.resolve(currentRootPath, filePath);
    }

    if (storedRootPath && path.isAbsolute(storedRootPath)) {
      const relativePath = path.relative(storedRootPath, filePath);
      if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
        return path.resolve(currentRootPath, relativePath);
      }
    }

    return filePath;
  }

  private buildStyleReferenceFileName(category: string, name: string): string {
    return `${this.sanitizeFileName(category)}--${this.sanitizeFileName(name)}.md`;
  }

  private wrapStyleReferenceContent(category: string, name: string, content: string): string {
    const metadata = JSON.stringify({ category, name });
    return `<!-- novel-style-meta: ${metadata} -->\n${content.trim()}\n`;
  }

  private parseStyleReferenceContent(content: string): { category: string; name: string; content: string } | null {
    const match = content.match(/^<!--\s*novel-style-meta:\s*(\{.*\})\s*-->\r?\n([\s\S]*)$/);
    if (!match) {
      return null;
    }

    try {
      const metadata = JSON.parse(match[1]) as { category?: string; name?: string };
      if (!metadata.category || !metadata.name) {
        return null;
      }

      return {
        category: metadata.category,
        name: metadata.name,
        content: match[2].trim(),
      };
    } catch {
      return null;
    }
  }

  private parseCharacterCardContent(content: string): { name: string; content: string } | null {
    const match = content.match(/^<!--\s*novel-character-meta:\s*(\{.*\})\s*-->\r?\n([\s\S]*)$/);
    if (!match) {
      return null;
    }

    try {
      const metadata = JSON.parse(match[1]) as { name?: string };
      if (!metadata.name) {
        return null;
      }

      return {
        name: metadata.name,
        content: match[2].trim(),
      };
    } catch {
      return null;
    }
  }

  private async readStyleReferenceDirectory(
    dirPath: string,
    skipReadme: boolean
  ): Promise<Array<{ category: string; name: string; content: string; path: string }>> {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md') && (!skipReadme || entry.name !== 'README.md'))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    const items: Array<{ category: string; name: string; content: string; path: string }> = [];
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      const rawContent = await readFile(filePath);
      const metadata = this.parseStyleReferenceContent(rawContent);
      const fallback = this.parseStyleReferenceFileName(file.name);
      items.push({
        category: metadata?.category ?? fallback.category,
        name: metadata?.name ?? fallback.name,
        content: metadata?.content ?? rawContent.trim(),
        path: filePath,
      });
    }

    return items;
  }

  private async readChapterPlanEntries(project: NovelProject): Promise<ChapterPlanEntry[]> {
    const jsonPath = path.join(project.rootPath, 'planning', 'chapter-plan.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const content = await readFile(jsonPath);
        const parsed = JSON.parse(content) as ChapterPlanEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter(entry => Number.isFinite(entry.chapterNumber))
            .sort((a, b) => a.chapterNumber - b.chapterNumber);
        }
      } catch {
        // Fall through to markdown parsing.
      }
    }

    const markdown = await this.readChapterPlan(project);
    const parsedFromMarkdown = this.parseChapterPlanMarkdown(markdown);
    return parsedFromMarkdown.length > 0 ? parsedFromMarkdown : this.buildInitialChapterPlanEntries();
  }

  private async saveChapterPlanEntries(project: NovelProject, entries: ChapterPlanEntry[]): Promise<void> {
    const normalizedEntries = entries
      .slice()
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
    await writeFile(
      path.join(project.rootPath, 'planning', 'chapter-plan.json'),
      JSON.stringify(normalizedEntries, null, 2) + '\n'
    );
  }

  private parseChapterPlanMarkdown(content: string): ChapterPlanEntry[] {
    const entries: ChapterPlanEntry[] = [];
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim().startsWith('|')) {
        continue;
      }

      const cells = line
        .split('|')
        .slice(1, -1)
        .map(cell => cell.trim());

      if (cells.length < 6) {
        continue;
      }

      const chapterNumber = Number(cells[0]);
      if (!Number.isFinite(chapterNumber)) {
        continue;
      }

      entries.push({
        chapterNumber,
        title: cells[1] || '待定',
        status: cells[2] || '待写',
        goal: cells[3] || '(暂无)',
        conflict: cells[4] || '(暂无)',
        note: cells[5] || '(暂无)',
      });
    }

    return entries.sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  private mergeChapterPlanEntry(
    current: ChapterPlanEntry,
    patch: {
      chapterNumber: number;
      title?: string;
      status?: string;
      goal?: string;
      conflict?: string;
      note?: string;
    }
  ): ChapterPlanEntry {
    return {
      chapterNumber: patch.chapterNumber,
      title: patch.title?.trim() || current.title || '待定',
      status: patch.status?.trim() || current.status || '待写',
      goal: patch.goal?.trim() || current.goal || '(暂无)',
      conflict: patch.conflict?.trim() || current.conflict || '(暂无)',
      note: patch.note?.trim() || current.note || '(暂无)',
    };
  }
}
