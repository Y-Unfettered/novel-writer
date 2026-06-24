/**
 * Project Manager - handles project creation, loading, saving
 */

import fs from 'fs';
import path from 'path';
import {
  ChapterInfo,
  ChapterPlanEntry,
  CreatureCard,
  CreatureCategory,
  DangerLevel,
  DangerLevelHistoryEntry,
  DEFAULT_CONFIG,
  NovelProject,
  ThreatLevel,
} from './types';
import { countWords, ensureDir, formatChapterNumber, readFile, writeFile } from './utils';

const CREATURE_CATEGORIES: CreatureCategory[] = ['神话异兽', '野兽', '虫类', '禽类', '鳞类', '植株'];
const EMPTY_TEXT = '(暂无)';

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
    await this.createCreatureDirectories(rootPath);

    await writeFile(path.join(rootPath, 'global-summary.md'), this.buildInitialGlobalSummary(title, basicSetting));
    await writeFile(path.join(rootPath, 'characters', '人物关系.md'), this.buildInitialCharacterRelationships());
    await writeFile(path.join(rootPath, 'characters', 'cards', 'README.md'), this.buildInitialCharacterCardGuide());
    await writeFile(path.join(rootPath, 'planning', 'timeline.md'), this.buildInitialTimeline());

    const chapterPlanEntries = this.buildInitialChapterPlanEntries();
    await this.saveChapterPlanEntries(project, chapterPlanEntries);
    await writeFile(path.join(rootPath, 'planning', 'chapter-plan.md'), this.renderChapterPlanMarkdown(chapterPlanEntries));
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
    project.currentChapter = Math.max(project.currentChapter, chapterNumber);

    await this.saveProject(project);
    return chapterInfo;
  }

  async saveChapterDraft(
    project: NovelProject,
    chapterNumber: number,
    chapterTitle: string,
    content: string
  ): Promise<string> {
    const draftPath = path.join(project.rootPath, 'chapters', 'drafts', `${formatChapterNumber(chapterNumber)}-draft.md`);
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
    await writeFile(chapter.summaryPath, summary.trim() + '\n');
  }

  async readGlobalSummary(project: NovelProject): Promise<string> {
    return this.readOptionalFile(path.join(project.rootPath, 'global-summary.md'));
  }

  async saveGlobalSummary(project: NovelProject, summary: string): Promise<void> {
    await writeFile(path.join(project.rootPath, 'global-summary.md'), summary.trim() + '\n');
  }

  async readCharacterRelationships(project: NovelProject): Promise<string> {
    return this.readOptionalFile(path.join(project.rootPath, 'characters', '人物关系.md'));
  }

  async saveCharacterRelationships(project: NovelProject, content: string): Promise<void> {
    await writeFile(path.join(project.rootPath, 'characters', '人物关系.md'), content.trim() + '\n');
  }

  async readTimeline(project: NovelProject): Promise<string> {
    return this.readOptionalFile(path.join(project.rootPath, 'planning', 'timeline.md'));
  }

  async saveTimeline(project: NovelProject, content: string): Promise<void> {
    await writeFile(path.join(project.rootPath, 'planning', 'timeline.md'), content.trim() + '\n');
  }

  async readChapterPlan(project: NovelProject): Promise<string> {
    return this.readOptionalFile(path.join(project.rootPath, 'planning', 'chapter-plan.md'));
  }

  async saveChapterPlan(project: NovelProject, content: string): Promise<void> {
    await writeFile(path.join(project.rootPath, 'planning', 'chapter-plan.md'), content.trim() + '\n');
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
    const filePath = path.join(project.rootPath, 'characters', 'cards', `${this.sanitizeFileName(name)}.md`);
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
    const filePath = path.join(project.rootPath, 'references', 'raw', this.buildStyleReferenceFileName(category, name));
    await writeFile(filePath, this.wrapStyleReferenceContent(category, name, content));
    return filePath;
  }

  async saveStyleReferenceCard(
    project: NovelProject,
    category: string,
    name: string,
    content: string
  ): Promise<string> {
    const filePath = path.join(project.rootPath, 'references', 'cards', this.buildStyleReferenceFileName(category, name));
    await writeFile(filePath, this.wrapStyleReferenceContent(category, name, content));
    return filePath;
  }

  async createProjectSnapshot(project: NovelProject, label?: string): Promise<string> {
    const timestamp = this.buildSnapshotTimestamp();
    const safeLabel = label?.trim() ? `-${this.sanitizeFileName(label.trim())}` : '';
    const snapshotRoot = path.join(project.rootPath, 'snapshots', `${timestamp}${safeLabel}`);
    await ensureDir(snapshotRoot);

    const targets = ['novel.json', 'global-summary.md', 'chapters', 'characters', 'planning', 'references', 'creatures'];
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

  async saveCreatureCard(
    project: NovelProject,
    name: string,
    category: CreatureCategory,
    content: string,
    dangerLevel: DangerLevel = '中'
  ): Promise<string> {
    const filePath = path.join(project.rootPath, 'creatures', category, `${this.sanitizeFileName(name)}.md`);
    await writeFile(filePath, this.wrapCreatureCardContent(name, category, content, dangerLevel));
    return filePath;
  }

  async saveCreatureCardFromObject(
    project: NovelProject,
    category: CreatureCategory,
    name: string,
    card: CreatureCard
  ): Promise<string> {
    const filePath = path.join(project.rootPath, 'creatures', category, `${this.sanitizeFileName(name)}.md`);
    const content = this.renderCreatureCardMarkdown(card);
    await writeFile(filePath, this.wrapCreatureCardContent(card.name, card.category, content, card.baseDangerLevel));
    return filePath;
  }

  async readCreatureCard(project: NovelProject, category: CreatureCategory, name: string): Promise<CreatureCard | null> {
    const filePath = path.join(project.rootPath, 'creatures', category, `${this.sanitizeFileName(name)}.md`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const rawContent = await readFile(filePath);
    return this.parseCreatureCardContent(rawContent);
  }

  async readCreatureCards(project: NovelProject, category: CreatureCategory): Promise<Array<{ name: string; content: string; path: string }>> {
    return this.readCreatureCardDirectory(path.join(project.rootPath, 'creatures', category));
  }

  async readAllCreatureCards(project: NovelProject): Promise<Array<{ category: CreatureCategory; name: string; content: string; path: string }>> {
    const cards: Array<{ category: CreatureCategory; name: string; content: string; path: string }> = [];
    for (const category of await this.readCreatureCategories(project)) {
      const categoryCards = await this.readCreatureCards(project, category);
      for (const card of categoryCards) {
        cards.push({ category, ...card });
      }
    }
    return cards;
  }

  async readCreatureCategories(project: NovelProject): Promise<CreatureCategory[]> {
    const creaturesRoot = path.join(project.rootPath, 'creatures');
    if (!fs.existsSync(creaturesRoot)) {
      return [];
    }

    const entries = await fs.promises.readdir(creaturesRoot, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory() && CREATURE_CATEGORIES.includes(entry.name as CreatureCategory))
      .map(entry => entry.name as CreatureCategory)
      .sort((a, b) => CREATURE_CATEGORIES.indexOf(a) - CREATURE_CATEGORIES.indexOf(b));
  }

  async updateCreatureDangerLevel(
    project: NovelProject,
    category: CreatureCategory,
    name: string,
    chapterNumber: number,
    dangerLevel: DangerLevel,
    threatLevel: ThreatLevel,
    protagonistStatus: string,
    note: string
  ): Promise<void> {
    const card = await this.readCreatureCard(project, category, name);
    if (!card) {
      return;
    }

    const historyEntry: DangerLevelHistoryEntry = {
      chapterNumber,
      dangerLevel,
      threatLevel,
      protagonistStatus,
      note,
    };

    const existingIndex = card.dangerLevelHistory.findIndex(entry => entry.chapterNumber === chapterNumber);
    if (existingIndex >= 0) {
      card.dangerLevelHistory[existingIndex] = historyEntry;
    } else {
      card.dangerLevelHistory.push(historyEntry);
      card.dangerLevelHistory.sort((a, b) => a.chapterNumber - b.chapterNumber);
    }

    await this.saveCreatureCardFromObject(project, category, name, card);
  }

  async appendCreatureChapterRecord(
    project: NovelProject,
    category: CreatureCategory,
    name: string,
    chapterNumber: number,
    chapterTitle: string,
    record: string
  ): Promise<void> {
    const card = await this.readCreatureCard(project, category, name);
    if (!card) {
      return;
    }

    const recordEntry = `第${chapterNumber}章${chapterTitle ? ` ${chapterTitle}` : ''}：${record}`;
    if (!card.chapterRecords.includes(recordEntry)) {
      card.chapterRecords.push(recordEntry);
    }
    await this.saveCreatureCardFromObject(project, category, name, card);
  }

  async findCreatureCard(project: NovelProject, name: string): Promise<{ category: CreatureCategory; card: CreatureCard } | null> {
    for (const category of await this.readCreatureCategories(project)) {
      const card = await this.readCreatureCard(project, category, name);
      if (card) {
        return { category, card };
      }
    }
    return null;
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

  buildDefaultCreatureCard(
    name: string,
    category: CreatureCategory,
    firstAppearance: string,
    baseDangerLevel: DangerLevel
  ): CreatureCard {
    return {
      name,
      category,
      firstAppearance,
      baseDangerLevel,
      appearance: { size: '', features: '', colors: '', specialMarks: '' },
      abilities: { attack: '', defense: '', special: '', weakness: '' },
      ecology: { habitat: '', activityPattern: '', diet: '', socialBehavior: '' },
      utility: { edible: '', material: '', medicinal: '', other: '' },
      distribution: { mainAreas: '', range: '', humanRelation: '' },
      dangerLevelHistory: [
        {
          chapterNumber: parseInt(firstAppearance.match(/\d+/)?.[0] || '1', 10),
          dangerLevel: baseDangerLevel,
          threatLevel: this.getThreatLevel(baseDangerLevel),
          protagonistStatus: '待补充',
          note: '首次出场',
        },
      ],
      chapterRecords: [],
    };
  }

  private async createCreatureDirectories(rootPath: string): Promise<void> {
    const creaturesRoot = path.join(rootPath, 'creatures');
    await ensureDir(creaturesRoot);
    await ensureDir(path.join(creaturesRoot, 'raw'));
    for (const category of CREATURE_CATEGORIES) {
      await ensureDir(path.join(creaturesRoot, category));
      await ensureDir(path.join(creaturesRoot, 'raw', category));
      await writeFile(path.join(creaturesRoot, category, 'README.md'), this.buildInitialCreatureCategoryGuide(category));
    }
  }

  private async readOptionalFile(filePath: string): Promise<string> {
    return fs.existsSync(filePath) ? readFile(filePath) : '';
  }

  private buildInitialGlobalSummary(title: string, setting: string): string {
    return `# ${title} - 全局摘要

## 世界观设定
${setting || EMPTY_TEXT}

## 主要人物
${EMPTY_TEXT}

## 主线进展
${EMPTY_TEXT}

## 活跃伏笔
${EMPTY_TEXT}

## 已完结情节
${EMPTY_TEXT}
`;
  }

  private buildInitialCharacterRelationships(): string {
    return `# 人物关系

## 主要人物
${EMPTY_TEXT}

## 人物关系
${EMPTY_TEXT}

## 当前状态
${EMPTY_TEXT}
`;
  }

  private buildInitialCharacterCardGuide(): string {
    return `# 角色卡说明

这里用于保存单个角色的独立卡片。
建议至少包含：身份、立场、首次出场、人物简介、最近章节记录。
`;
  }

  private buildInitialTimeline(): string {
    return `# 时间线

## 当前故事时间线

| 序号 | 时间/时段 | 章节 | 地点 | 事件 | 涉及人物 |
| --- | --- | --- | --- | --- | --- |
| 1 | 待定 | 待定 | 待定 | ${EMPTY_TEXT} | ${EMPTY_TEXT} |
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
      goal: EMPTY_TEXT,
      conflict: EMPTY_TEXT,
      note: EMPTY_TEXT,
    };
  }

  private renderChapterPlanMarkdown(entries: ChapterPlanEntry[]): string {
    const rows = entries
      .slice()
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
      .map(entry => `| ${entry.chapterNumber} | ${entry.title} | ${entry.status} | ${entry.goal} | ${entry.conflict} | ${entry.note} |`)
      .join('\n');

    return `# 章节计划表

| 章节 | 标题 | 状态 | 本章目标 | 关键冲突 | 备注 |
| --- | --- | --- | --- | --- | --- |
${rows}

状态建议：待写 / 草稿 / 已完成 / 已定稿
`;
  }

  private buildInitialStyleReferenceGuide(): string {
    return `# 风格参考库说明

原始素材放在 references/raw，提炼后的风格卡放在 references/cards。
`;
  }

  private buildInitialCreatureCategoryGuide(category: CreatureCategory): string {
    return `# ${category} 说明

此目录用于保存 ${category} 生物卡片。
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

  private wrapStyleReferenceContent(category: string, name: string, content: string): string {
    const metadata = JSON.stringify({ category, name });
    return `<!-- novel-style-meta: ${metadata} -->\n${content.trim()}\n`;
  }

  private wrapCreatureCardContent(
    name: string,
    category: CreatureCategory,
    content: string,
    dangerLevel: DangerLevel
  ): string {
    const metadata = JSON.stringify({ name, category, dangerLevel });
    return `<!-- novel-creature-meta: ${metadata} -->\n${content.trim()}\n`;
  }

  private buildSnapshotTimestamp(): string {
    const now = new Date();
    return [
      now.getFullYear(),
      `${now.getMonth() + 1}`.padStart(2, '0'),
      `${now.getDate()}`.padStart(2, '0'),
      '-',
      `${now.getHours()}`.padStart(2, '0'),
      `${now.getMinutes()}`.padStart(2, '0'),
      `${now.getSeconds()}`.padStart(2, '0'),
    ].join('');
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
    const normalized: NovelProject = {
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
    normalized.totalChapters = normalized.chapters.length;
    normalized.currentChapter = normalized.currentChapter || normalized.chapters.at(-1)?.number || 0;
    return normalized;
  }

  private toStoredProject(project: NovelProject): NovelProject {
    return {
      ...project,
      rootPath: '.',
      config: {
        ...DEFAULT_CONFIG,
        ...(project.config ?? {}),
      },
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
      return { category: metadata.category, name: metadata.name, content: match[2].trim() };
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
      return { name: metadata.name, content: match[2].trim() };
    } catch {
      return null;
    }
  }

  private parseCreatureCardContent(content: string): CreatureCard | null {
    const match = content.match(/^<!--\s*novel-creature-meta:\s*(\{.*\})\s*-->\r?\n([\s\S]*)$/);
    if (!match) {
      return null;
    }

    try {
      const metadata = JSON.parse(match[1]) as {
        name?: string;
        category?: CreatureCategory;
        dangerLevel?: DangerLevel;
      };
      if (!metadata.name || !metadata.category) {
        return null;
      }

      const parsed = this.parseCreatureCardBody(match[2].trim());
      return {
        name: metadata.name,
        category: metadata.category,
        firstAppearance: parsed.firstAppearance || '未知',
        baseDangerLevel: metadata.dangerLevel || parsed.baseDangerLevel || '中',
        appearance: parsed.appearance || { size: '', features: '', colors: '', specialMarks: '' },
        abilities: parsed.abilities || { attack: '', defense: '', special: '', weakness: '' },
        ecology: parsed.ecology || { habitat: '', activityPattern: '', diet: '', socialBehavior: '' },
        utility: parsed.utility || { edible: '', material: '', medicinal: '', other: '' },
        distribution: parsed.distribution || { mainAreas: '', range: '', humanRelation: '' },
        dangerLevelHistory: parsed.dangerLevelHistory || [],
        chapterRecords: parsed.chapterRecords || [],
      };
    } catch {
      return null;
    }
  }

  private parseCreatureCardBody(body: string): Partial<CreatureCard> {
    const result: Partial<CreatureCard> = {
      dangerLevelHistory: [],
      chapterRecords: [],
      appearance: { size: '', features: '', colors: '', specialMarks: '' },
      abilities: { attack: '', defense: '', special: '', weakness: '' },
      ecology: { habitat: '', activityPattern: '', diet: '', socialBehavior: '' },
      utility: { edible: '', material: '', medicinal: '', other: '' },
      distribution: { mainAreas: '', range: '', humanRelation: '' },
    };

    const lines = body.split(/\r?\n/);
    let currentSection = '';

    for (const line of lines) {
      if (line.startsWith('## ')) {
        currentSection = line.slice(3).trim();
        continue;
      }

      const cleanLine = line.replace(/^\s*[-*]\s*/, '').trim();
      if (!cleanLine) {
        continue;
      }

      if (currentSection === '基础信息') {
        if (cleanLine.startsWith('首次出场：')) result.firstAppearance = cleanLine.replace('首次出场：', '').trim();
        if (cleanLine.startsWith('基础危险等级：')) result.baseDangerLevel = cleanLine.replace('基础危险等级：', '').trim() as DangerLevel;
      } else if (currentSection === '外观描述') {
        if (cleanLine.startsWith('体型：')) result.appearance!.size = cleanLine.replace('体型：', '').trim();
        else if (cleanLine.startsWith('外形特征：')) result.appearance!.features = cleanLine.replace('外形特征：', '').trim();
        else if (cleanLine.startsWith('颜色/纹路：')) result.appearance!.colors = cleanLine.replace('颜色/纹路：', '').trim();
        else if (cleanLine.startsWith('特殊标记：')) result.appearance!.specialMarks = cleanLine.replace('特殊标记：', '').trim();
      } else if (currentSection === '能力与特征') {
        if (cleanLine.startsWith('攻击方式：')) result.abilities!.attack = cleanLine.replace('攻击方式：', '').trim();
        else if (cleanLine.startsWith('防御能力：')) result.abilities!.defense = cleanLine.replace('防御能力：', '').trim();
        else if (cleanLine.startsWith('特殊能力：')) result.abilities!.special = cleanLine.replace('特殊能力：', '').trim();
        else if (cleanLine.startsWith('弱点：')) result.abilities!.weakness = cleanLine.replace('弱点：', '').trim();
      } else if (currentSection === '生态与习性') {
        if (cleanLine.startsWith('栖息环境：')) result.ecology!.habitat = cleanLine.replace('栖息环境：', '').trim();
        else if (cleanLine.startsWith('行动规律：')) result.ecology!.activityPattern = cleanLine.replace('行动规律：', '').trim();
        else if (cleanLine.startsWith('食性：')) result.ecology!.diet = cleanLine.replace('食性：', '').trim();
        else if (cleanLine.startsWith('群居属性：')) result.ecology!.socialBehavior = cleanLine.replace('群居属性：', '').trim();
      } else if (currentSection === '用途与价值') {
        if (cleanLine.startsWith('食用价值：')) result.utility!.edible = cleanLine.replace('食用价值：', '').trim();
        else if (cleanLine.startsWith('材料价值：')) result.utility!.material = cleanLine.replace('材料价值：', '').trim();
        else if (cleanLine.startsWith('药用价值：')) result.utility!.medicinal = cleanLine.replace('药用价值：', '').trim();
        else if (cleanLine.startsWith('其他价值：')) result.utility!.other = cleanLine.replace('其他价值：', '').trim();
      } else if (currentSection === '已知分布') {
        if (cleanLine.startsWith('主要分布区域：')) result.distribution!.mainAreas = cleanLine.replace('主要分布区域：', '').trim();
        else if (cleanLine.startsWith('活动范围边界：')) result.distribution!.range = cleanLine.replace('活动范围边界：', '').trim();
        else if (cleanLine.startsWith('与人类活动区域的关系：')) result.distribution!.humanRelation = cleanLine.replace('与人类活动区域的关系：', '').trim();
      } else if (currentSection === '危险等级历史（动态变化）' && line.trim().startsWith('|')) {
        const cells = line
          .trim()
          .split('|')
          .map(cell => cell.trim())
          .filter(Boolean);
        if (cells.length >= 5 && /^第\d+章$/.test(cells[0])) {
          result.dangerLevelHistory!.push({
            chapterNumber: parseInt(cells[0].match(/\d+/)?.[0] || '0', 10),
            dangerLevel: cells[1] as DangerLevel,
            threatLevel: cells[2] as ThreatLevel,
            protagonistStatus: cells[3],
            note: cells[4],
          });
        }
      } else if (currentSection === '章节互动记录' && line.trim().startsWith('- ')) {
        result.chapterRecords!.push(line.trim().replace(/^-/, '').trim());
      }
    }

    return result;
  }

  private renderCreatureCardMarkdown(card: CreatureCard): string {
    const lines: string[] = [
      `# ${card.name}`,
      '',
      '## 基础信息',
      `- 分类：${card.category}`,
      `- 首次出场：${card.firstAppearance}`,
      `- 基础危险等级：${card.baseDangerLevel}`,
      '',
      '## 外观描述',
      `- 体型：${card.appearance.size}`,
      `- 外形特征：${card.appearance.features}`,
      `- 颜色/纹路：${card.appearance.colors}`,
      `- 特殊标记：${card.appearance.specialMarks}`,
      '',
      '## 能力与特征',
      `- 攻击方式：${card.abilities.attack}`,
      `- 防御能力：${card.abilities.defense}`,
      `- 特殊能力：${card.abilities.special}`,
      `- 弱点：${card.abilities.weakness}`,
      '',
      '## 生态与习性',
      `- 栖息环境：${card.ecology.habitat}`,
      `- 行动规律：${card.ecology.activityPattern}`,
      `- 食性：${card.ecology.diet}`,
      `- 群居属性：${card.ecology.socialBehavior}`,
      '',
      '## 用途与价值',
      `- 食用价值：${card.utility.edible}`,
      `- 材料价值：${card.utility.material}`,
      `- 药用价值：${card.utility.medicinal}`,
      `- 其他价值：${card.utility.other}`,
      '',
      '## 已知分布',
      `- 主要分布区域：${card.distribution.mainAreas}`,
      `- 活动范围边界：${card.distribution.range}`,
      `- 与人类活动区域的关系：${card.distribution.humanRelation}`,
      '',
      '## 危险等级历史（动态变化）',
      '',
      '| 章节 | 危险等级 | 威胁程度 | 当时主角/部落状态 | 备注 |',
      '| --- | --- | --- | --- | --- |',
    ];

    for (const entry of card.dangerLevelHistory) {
      lines.push(`| 第${entry.chapterNumber}章 | ${entry.dangerLevel} | ${entry.threatLevel} | ${entry.protagonistStatus} | ${entry.note} |`);
    }

    lines.push('', '## 章节互动记录');
    for (const record of card.chapterRecords) {
      lines.push(`- ${record}`);
    }

    return lines.join('\n');
  }

  private async readCreatureCardDirectory(dirPath: string): Promise<Array<{ name: string; content: string; path: string }>> {
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
      const parsed = this.parseCreatureCardContent(rawContent);
      cards.push({
        name: parsed?.name ?? file.name.replace(/\.md$/i, '').replace(/_/g, ' '),
        content: parsed ? this.renderCreatureCardMarkdown(parsed) : rawContent.trim(),
        path: filePath,
      });
    }
    return cards;
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
          return parsed.map(entry => this.mergeChapterPlanEntry(this.createDefaultChapterPlanEntry(entry.chapterNumber), entry));
        }
      } catch {
        // fall through
      }
    }

    const markdown = await this.readChapterPlan(project);
    const parsedEntries = this.parseChapterPlanMarkdown(markdown);
    return parsedEntries.length > 0 ? parsedEntries : this.buildInitialChapterPlanEntries();
  }

  private async saveChapterPlanEntries(project: NovelProject, entries: ChapterPlanEntry[]): Promise<void> {
    const jsonPath = path.join(project.rootPath, 'planning', 'chapter-plan.json');
    const normalizedEntries = entries
      .slice()
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
      .map(entry => this.mergeChapterPlanEntry(this.createDefaultChapterPlanEntry(entry.chapterNumber), entry));
    await writeFile(jsonPath, JSON.stringify(normalizedEntries, null, 2) + '\n');
  }

  private parseChapterPlanMarkdown(markdown: string): ChapterPlanEntry[] {
    const lines = markdown.split(/\r?\n/);
    const rows = lines.filter(line => /^\|\s*\d+\s*\|/.test(line));
    return rows.map(row => {
      const cells = row
        .split('|')
        .map(cell => cell.trim())
        .filter(Boolean);
      return this.mergeChapterPlanEntry(this.createDefaultChapterPlanEntry(Number(cells[0])), {
        chapterNumber: Number(cells[0]),
        title: cells[1],
        status: cells[2],
        goal: cells[3],
        conflict: cells[4],
        note: cells[5],
      });
    });
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
      goal: patch.goal?.trim() || current.goal || EMPTY_TEXT,
      conflict: patch.conflict?.trim() || current.conflict || EMPTY_TEXT,
      note: patch.note?.trim() || current.note || EMPTY_TEXT,
    };
  }

  private getThreatLevel(dangerLevel: DangerLevel): ThreatLevel {
    switch (dangerLevel) {
      case '极高':
        return '致命威胁';
      case '高':
        return '危险生物';
      case '中':
        return '潜在威胁';
      case '低':
      case '无害':
      default:
        return '相对安全';
    }
  }
}
