"use strict";
/**
 * Project Manager - handles project creation, loading, saving
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const types_1 = require("./types");
const utils_1 = require("./utils");
const CREATURE_CATEGORIES = ['神话异兽', '野兽', '虫类', '禽类', '鳞类', '植株'];
const EMPTY_TEXT = '(暂无)';
class ProjectManager {
    async createNewProject(title, author, rootPath, basicSetting) {
        const now = Date.now();
        const project = {
            title,
            author,
            rootPath,
            createdAt: now,
            updatedAt: now,
            totalChapters: 0,
            currentChapter: 0,
            config: { ...types_1.DEFAULT_CONFIG },
            chapters: [],
        };
        await (0, utils_1.ensureDir)(rootPath);
        await (0, utils_1.ensureDir)(path_1.default.join(rootPath, 'chapters'));
        await (0, utils_1.ensureDir)(path_1.default.join(rootPath, 'chapters', 'drafts'));
        await (0, utils_1.ensureDir)(path_1.default.join(rootPath, 'characters'));
        await (0, utils_1.ensureDir)(path_1.default.join(rootPath, 'characters', 'cards'));
        await (0, utils_1.ensureDir)(path_1.default.join(rootPath, 'planning'));
        await (0, utils_1.ensureDir)(path_1.default.join(rootPath, 'references', 'raw'));
        await (0, utils_1.ensureDir)(path_1.default.join(rootPath, 'references', 'cards'));
        await this.createCreatureDirectories(rootPath);
        await (0, utils_1.writeFile)(path_1.default.join(rootPath, 'global-summary.md'), this.buildInitialGlobalSummary(title, basicSetting));
        await (0, utils_1.writeFile)(path_1.default.join(rootPath, 'characters', '人物关系.md'), this.buildInitialCharacterRelationships());
        await (0, utils_1.writeFile)(path_1.default.join(rootPath, 'characters', 'cards', 'README.md'), this.buildInitialCharacterCardGuide());
        await (0, utils_1.writeFile)(path_1.default.join(rootPath, 'planning', 'timeline.md'), this.buildInitialTimeline());
        const chapterPlanEntries = this.buildInitialChapterPlanEntries();
        await this.saveChapterPlanEntries(project, chapterPlanEntries);
        await (0, utils_1.writeFile)(path_1.default.join(rootPath, 'planning', 'chapter-plan.md'), this.renderChapterPlanMarkdown(chapterPlanEntries));
        await (0, utils_1.writeFile)(path_1.default.join(rootPath, 'references', 'cards', 'README.md'), this.buildInitialStyleReferenceGuide());
        await this.saveProject(project);
        return project;
    }
    async loadProject(projectPath) {
        const novelJsonPath = path_1.default.join(projectPath, 'novel.json');
        if (!fs_1.default.existsSync(novelJsonPath)) {
            throw new Error(`Not a valid novel project: ${projectPath} (no novel.json)`);
        }
        const content = await (0, utils_1.readFile)(novelJsonPath);
        const project = JSON.parse(content);
        return this.normalizeLoadedProject(projectPath, project);
    }
    async saveProject(project) {
        project.updatedAt = Date.now();
        const novelJsonPath = path_1.default.join(project.rootPath, 'novel.json');
        await (0, utils_1.writeFile)(novelJsonPath, JSON.stringify(this.toStoredProject(project), null, 2));
    }
    async saveChapter(project, chapterNumber, chapterTitle, content) {
        const formattedNum = (0, utils_1.formatChapterNumber)(chapterNumber);
        const contentPath = path_1.default.join(project.rootPath, 'chapters', `${formattedNum}.md`);
        const summaryPath = path_1.default.join(project.rootPath, 'chapters', `${formattedNum}-summary.md`);
        const existingIndex = project.chapters.findIndex(chapter => chapter.number === chapterNumber);
        const now = Date.now();
        const chapterInfo = {
            number: chapterNumber,
            title: chapterTitle,
            contentPath,
            summaryPath,
            wordCount: (0, utils_1.countWords)(content),
            createdAt: existingIndex >= 0 ? project.chapters[existingIndex].createdAt : now,
            updatedAt: now,
        };
        await (0, utils_1.writeFile)(contentPath, this.wrapChapterContent(chapterNumber, chapterTitle, content));
        if (existingIndex >= 0) {
            project.chapters[existingIndex] = chapterInfo;
        }
        else {
            project.chapters.push(chapterInfo);
            project.chapters.sort((a, b) => a.number - b.number);
        }
        project.totalChapters = project.chapters.length;
        project.currentChapter = Math.max(project.currentChapter, chapterNumber);
        await this.saveProject(project);
        return chapterInfo;
    }
    async saveChapterDraft(project, chapterNumber, chapterTitle, content) {
        const draftPath = path_1.default.join(project.rootPath, 'chapters', 'drafts', `${(0, utils_1.formatChapterNumber)(chapterNumber)}-draft.md`);
        await (0, utils_1.writeFile)(draftPath, this.wrapChapterContent(chapterNumber, chapterTitle, content));
        return draftPath;
    }
    async readChapterContent(chapter) {
        return (0, utils_1.readFile)(chapter.contentPath);
    }
    async readChapterSummary(chapter) {
        if (!fs_1.default.existsSync(chapter.summaryPath)) {
            return '';
        }
        return (0, utils_1.readFile)(chapter.summaryPath);
    }
    async saveChapterSummary(chapter, summary) {
        await (0, utils_1.writeFile)(chapter.summaryPath, summary.trim() + '\n');
    }
    async readGlobalSummary(project) {
        return this.readOptionalFile(path_1.default.join(project.rootPath, 'global-summary.md'));
    }
    async saveGlobalSummary(project, summary) {
        await (0, utils_1.writeFile)(path_1.default.join(project.rootPath, 'global-summary.md'), summary.trim() + '\n');
    }
    async readCharacterRelationships(project) {
        return this.readOptionalFile(path_1.default.join(project.rootPath, 'characters', '人物关系.md'));
    }
    async saveCharacterRelationships(project, content) {
        await (0, utils_1.writeFile)(path_1.default.join(project.rootPath, 'characters', '人物关系.md'), content.trim() + '\n');
    }
    async readTimeline(project) {
        return this.readOptionalFile(path_1.default.join(project.rootPath, 'planning', 'timeline.md'));
    }
    async saveTimeline(project, content) {
        await (0, utils_1.writeFile)(path_1.default.join(project.rootPath, 'planning', 'timeline.md'), content.trim() + '\n');
    }
    async readChapterPlan(project) {
        return this.readOptionalFile(path_1.default.join(project.rootPath, 'planning', 'chapter-plan.md'));
    }
    async saveChapterPlan(project, content) {
        await (0, utils_1.writeFile)(path_1.default.join(project.rootPath, 'planning', 'chapter-plan.md'), content.trim() + '\n');
        const parsedEntries = this.parseChapterPlanMarkdown(content);
        if (parsedEntries.length > 0) {
            await this.saveChapterPlanEntries(project, parsedEntries);
        }
    }
    async upsertChapterPlanEntry(project, entry) {
        const entries = await this.readChapterPlanEntries(project);
        const existingIndex = entries.findIndex(item => item.chapterNumber === entry.chapterNumber);
        const nextEntry = this.mergeChapterPlanEntry(existingIndex >= 0 ? entries[existingIndex] : this.createDefaultChapterPlanEntry(entry.chapterNumber), entry);
        if (existingIndex >= 0) {
            entries[existingIndex] = nextEntry;
        }
        else {
            entries.push(nextEntry);
            entries.sort((a, b) => a.chapterNumber - b.chapterNumber);
        }
        await this.saveChapterPlanEntries(project, entries);
        await (0, utils_1.writeFile)(path_1.default.join(project.rootPath, 'planning', 'chapter-plan.md'), this.renderChapterPlanMarkdown(entries));
    }
    async saveCharacterCard(project, name, content) {
        const filePath = path_1.default.join(project.rootPath, 'characters', 'cards', `${this.sanitizeFileName(name)}.md`);
        await (0, utils_1.writeFile)(filePath, this.wrapCharacterCardContent(name, content));
        return filePath;
    }
    async readCharacterCards(project) {
        const dirPath = path_1.default.join(project.rootPath, 'characters', 'cards');
        if (!fs_1.default.existsSync(dirPath)) {
            return [];
        }
        const entries = await fs_1.default.promises.readdir(dirPath, { withFileTypes: true });
        const files = entries
            .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
            .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        const cards = [];
        for (const file of files) {
            const filePath = path_1.default.join(dirPath, file.name);
            const rawContent = await (0, utils_1.readFile)(filePath);
            const parsed = this.parseCharacterCardContent(rawContent);
            cards.push({
                name: parsed?.name ?? file.name.replace(/\.md$/i, '').replace(/_/g, ' '),
                content: parsed?.content ?? rawContent.trim(),
                path: filePath,
            });
        }
        return cards;
    }
    async saveStyleReferenceRaw(project, category, name, content) {
        const filePath = path_1.default.join(project.rootPath, 'references', 'raw', this.buildStyleReferenceFileName(category, name));
        await (0, utils_1.writeFile)(filePath, this.wrapStyleReferenceContent(category, name, content));
        return filePath;
    }
    async saveStyleReferenceCard(project, category, name, content) {
        const filePath = path_1.default.join(project.rootPath, 'references', 'cards', this.buildStyleReferenceFileName(category, name));
        await (0, utils_1.writeFile)(filePath, this.wrapStyleReferenceContent(category, name, content));
        return filePath;
    }
    async createProjectSnapshot(project, label) {
        const timestamp = this.buildSnapshotTimestamp();
        const safeLabel = label?.trim() ? `-${this.sanitizeFileName(label.trim())}` : '';
        const snapshotRoot = path_1.default.join(project.rootPath, 'snapshots', `${timestamp}${safeLabel}`);
        await (0, utils_1.ensureDir)(snapshotRoot);
        const targets = ['novel.json', 'global-summary.md', 'chapters', 'characters', 'planning', 'references', 'creatures'];
        for (const target of targets) {
            const sourcePath = path_1.default.join(project.rootPath, target);
            if (!fs_1.default.existsSync(sourcePath)) {
                continue;
            }
            await this.copySnapshotItem(sourcePath, path_1.default.join(snapshotRoot, target));
        }
        await (0, utils_1.writeFile)(path_1.default.join(snapshotRoot, 'SNAPSHOT.md'), `# Snapshot\n\n- createdAt: ${new Date().toISOString()}\n- title: ${project.title}\n- currentChapter: ${project.currentChapter}\n`);
        return snapshotRoot;
    }
    async readStyleReferenceCards(project) {
        return this.readStyleReferenceDirectory(path_1.default.join(project.rootPath, 'references', 'cards'), true);
    }
    async readStyleReferenceRawMaterials(project) {
        return this.readStyleReferenceDirectory(path_1.default.join(project.rootPath, 'references', 'raw'), false);
    }
    async saveCreatureCard(project, name, category, content, dangerLevel = '中') {
        const filePath = path_1.default.join(project.rootPath, 'creatures', category, `${this.sanitizeFileName(name)}.md`);
        await (0, utils_1.writeFile)(filePath, this.wrapCreatureCardContent(name, category, content, dangerLevel));
        return filePath;
    }
    async saveCreatureCardFromObject(project, category, name, card) {
        const filePath = path_1.default.join(project.rootPath, 'creatures', category, `${this.sanitizeFileName(name)}.md`);
        const content = this.renderCreatureCardMarkdown(card);
        await (0, utils_1.writeFile)(filePath, this.wrapCreatureCardContent(card.name, card.category, content, card.baseDangerLevel));
        return filePath;
    }
    async readCreatureCard(project, category, name) {
        const filePath = path_1.default.join(project.rootPath, 'creatures', category, `${this.sanitizeFileName(name)}.md`);
        if (!fs_1.default.existsSync(filePath)) {
            return null;
        }
        const rawContent = await (0, utils_1.readFile)(filePath);
        return this.parseCreatureCardContent(rawContent);
    }
    async readCreatureCards(project, category) {
        return this.readCreatureCardDirectory(path_1.default.join(project.rootPath, 'creatures', category));
    }
    async readAllCreatureCards(project) {
        const cards = [];
        for (const category of await this.readCreatureCategories(project)) {
            const categoryCards = await this.readCreatureCards(project, category);
            for (const card of categoryCards) {
                cards.push({ category, ...card });
            }
        }
        return cards;
    }
    async readCreatureCategories(project) {
        const creaturesRoot = path_1.default.join(project.rootPath, 'creatures');
        if (!fs_1.default.existsSync(creaturesRoot)) {
            return [];
        }
        const entries = await fs_1.default.promises.readdir(creaturesRoot, { withFileTypes: true });
        return entries
            .filter(entry => entry.isDirectory() && CREATURE_CATEGORIES.includes(entry.name))
            .map(entry => entry.name)
            .sort((a, b) => CREATURE_CATEGORIES.indexOf(a) - CREATURE_CATEGORIES.indexOf(b));
    }
    async updateCreatureDangerLevel(project, category, name, chapterNumber, dangerLevel, threatLevel, protagonistStatus, note) {
        const card = await this.readCreatureCard(project, category, name);
        if (!card) {
            return;
        }
        const historyEntry = {
            chapterNumber,
            dangerLevel,
            threatLevel,
            protagonistStatus,
            note,
        };
        const existingIndex = card.dangerLevelHistory.findIndex(entry => entry.chapterNumber === chapterNumber);
        if (existingIndex >= 0) {
            card.dangerLevelHistory[existingIndex] = historyEntry;
        }
        else {
            card.dangerLevelHistory.push(historyEntry);
            card.dangerLevelHistory.sort((a, b) => a.chapterNumber - b.chapterNumber);
        }
        await this.saveCreatureCardFromObject(project, category, name, card);
    }
    async appendCreatureChapterRecord(project, category, name, chapterNumber, chapterTitle, record) {
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
    async findCreatureCard(project, name) {
        for (const category of await this.readCreatureCategories(project)) {
            const card = await this.readCreatureCard(project, category, name);
            if (card) {
                return { category, card };
            }
        }
        return null;
    }
    getChapter(project, number) {
        return project.chapters.find(chapter => chapter.number === number);
    }
    getSortedChapters(project) {
        return [...project.chapters].sort((a, b) => a.number - b.number);
    }
    getLastNChapters(project, n, beforeChapter) {
        const sorted = this.getSortedChapters(project);
        if (beforeChapter !== undefined) {
            return sorted.filter(chapter => chapter.number < beforeChapter).slice(-n);
        }
        return sorted.slice(-n);
    }
    buildDefaultCreatureCard(name, category, firstAppearance, baseDangerLevel) {
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
    async createCreatureDirectories(rootPath) {
        const creaturesRoot = path_1.default.join(rootPath, 'creatures');
        await (0, utils_1.ensureDir)(creaturesRoot);
        await (0, utils_1.ensureDir)(path_1.default.join(creaturesRoot, 'raw'));
        for (const category of CREATURE_CATEGORIES) {
            await (0, utils_1.ensureDir)(path_1.default.join(creaturesRoot, category));
            await (0, utils_1.ensureDir)(path_1.default.join(creaturesRoot, 'raw', category));
            await (0, utils_1.writeFile)(path_1.default.join(creaturesRoot, category, 'README.md'), this.buildInitialCreatureCategoryGuide(category));
        }
    }
    async readOptionalFile(filePath) {
        return fs_1.default.existsSync(filePath) ? (0, utils_1.readFile)(filePath) : '';
    }
    buildInitialGlobalSummary(title, setting) {
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
    buildInitialCharacterRelationships() {
        return `# 人物关系

## 主要人物
${EMPTY_TEXT}

## 人物关系
${EMPTY_TEXT}

## 当前状态
${EMPTY_TEXT}
`;
    }
    buildInitialCharacterCardGuide() {
        return `# 角色卡说明

这里用于保存单个角色的独立卡片。
建议至少包含：身份、立场、首次出场、人物简介、最近章节记录。
`;
    }
    buildInitialTimeline() {
        return `# 时间线

## 当前故事时间线

| 序号 | 时间/时段 | 章节 | 地点 | 事件 | 涉及人物 |
| --- | --- | --- | --- | --- | --- |
| 1 | 待定 | 待定 | 待定 | ${EMPTY_TEXT} | ${EMPTY_TEXT} |
`;
    }
    buildInitialChapterPlanEntries() {
        return [this.createDefaultChapterPlanEntry(1)];
    }
    createDefaultChapterPlanEntry(chapterNumber) {
        return {
            chapterNumber,
            title: '待定',
            status: '待写',
            goal: EMPTY_TEXT,
            conflict: EMPTY_TEXT,
            note: EMPTY_TEXT,
        };
    }
    renderChapterPlanMarkdown(entries) {
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
    buildInitialStyleReferenceGuide() {
        return `# 风格参考库说明

原始素材放在 references/raw，提炼后的风格卡放在 references/cards。
`;
    }
    buildInitialCreatureCategoryGuide(category) {
        return `# ${category} 说明

此目录用于保存 ${category} 生物卡片。
`;
    }
    sanitizeFileName(input) {
        return input.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/--+/g, '_').replace(/\s+/g, '_');
    }
    parseStyleReferenceFileName(fileName) {
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
    wrapChapterContent(number, title, content) {
        const heading = title.trim() ? `# 第${number}章 ${title.trim()}` : `# 第${number}章`;
        return `${heading}\n\n${content.trim()}\n`;
    }
    wrapCharacterCardContent(name, content) {
        const metadata = JSON.stringify({ name });
        return `<!-- novel-character-meta: ${metadata} -->\n${content.trim()}\n`;
    }
    wrapStyleReferenceContent(category, name, content) {
        const metadata = JSON.stringify({ category, name });
        return `<!-- novel-style-meta: ${metadata} -->\n${content.trim()}\n`;
    }
    wrapCreatureCardContent(name, category, content, dangerLevel) {
        const metadata = JSON.stringify({ name, category, dangerLevel });
        return `<!-- novel-creature-meta: ${metadata} -->\n${content.trim()}\n`;
    }
    buildSnapshotTimestamp() {
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
    async copySnapshotItem(sourcePath, destinationPath) {
        const stat = await fs_1.default.promises.stat(sourcePath);
        if (stat.isDirectory()) {
            await (0, utils_1.ensureDir)(destinationPath);
            const entries = await fs_1.default.promises.readdir(sourcePath, { withFileTypes: true });
            for (const entry of entries) {
                await this.copySnapshotItem(path_1.default.join(sourcePath, entry.name), path_1.default.join(destinationPath, entry.name));
            }
            return;
        }
        await (0, utils_1.ensureDir)(path_1.default.dirname(destinationPath));
        await fs_1.default.promises.copyFile(sourcePath, destinationPath);
    }
    normalizeLoadedProject(projectPath, project) {
        const storedRootPath = project.rootPath;
        const normalized = {
            ...project,
            rootPath: projectPath,
            config: {
                ...types_1.DEFAULT_CONFIG,
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
    toStoredProject(project) {
        return {
            ...project,
            rootPath: '.',
            config: {
                ...types_1.DEFAULT_CONFIG,
                ...(project.config ?? {}),
            },
            chapters: project.chapters.map(chapter => ({
                ...chapter,
                contentPath: path_1.default.relative(project.rootPath, chapter.contentPath),
                summaryPath: path_1.default.relative(project.rootPath, chapter.summaryPath),
            })),
        };
    }
    rebaseStoredPath(currentRootPath, storedRootPath, filePath) {
        if (!filePath) {
            return filePath;
        }
        if (!path_1.default.isAbsolute(filePath)) {
            return path_1.default.resolve(currentRootPath, filePath);
        }
        if (storedRootPath && path_1.default.isAbsolute(storedRootPath)) {
            const relativePath = path_1.default.relative(storedRootPath, filePath);
            if (!relativePath.startsWith('..') && !path_1.default.isAbsolute(relativePath)) {
                return path_1.default.resolve(currentRootPath, relativePath);
            }
        }
        return filePath;
    }
    buildStyleReferenceFileName(category, name) {
        return `${this.sanitizeFileName(category)}--${this.sanitizeFileName(name)}.md`;
    }
    parseStyleReferenceContent(content) {
        const match = content.match(/^<!--\s*novel-style-meta:\s*(\{.*\})\s*-->\r?\n([\s\S]*)$/);
        if (!match) {
            return null;
        }
        try {
            const metadata = JSON.parse(match[1]);
            if (!metadata.category || !metadata.name) {
                return null;
            }
            return { category: metadata.category, name: metadata.name, content: match[2].trim() };
        }
        catch {
            return null;
        }
    }
    parseCharacterCardContent(content) {
        const match = content.match(/^<!--\s*novel-character-meta:\s*(\{.*\})\s*-->\r?\n([\s\S]*)$/);
        if (!match) {
            return null;
        }
        try {
            const metadata = JSON.parse(match[1]);
            if (!metadata.name) {
                return null;
            }
            return { name: metadata.name, content: match[2].trim() };
        }
        catch {
            return null;
        }
    }
    parseCreatureCardContent(content) {
        const match = content.match(/^<!--\s*novel-creature-meta:\s*(\{.*\})\s*-->\r?\n([\s\S]*)$/);
        if (!match) {
            return null;
        }
        try {
            const metadata = JSON.parse(match[1]);
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
        }
        catch {
            return null;
        }
    }
    parseCreatureCardBody(body) {
        const result = {
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
                if (cleanLine.startsWith('首次出场：'))
                    result.firstAppearance = cleanLine.replace('首次出场：', '').trim();
                if (cleanLine.startsWith('基础危险等级：'))
                    result.baseDangerLevel = cleanLine.replace('基础危险等级：', '').trim();
            }
            else if (currentSection === '外观描述') {
                if (cleanLine.startsWith('体型：'))
                    result.appearance.size = cleanLine.replace('体型：', '').trim();
                else if (cleanLine.startsWith('外形特征：'))
                    result.appearance.features = cleanLine.replace('外形特征：', '').trim();
                else if (cleanLine.startsWith('颜色/纹路：'))
                    result.appearance.colors = cleanLine.replace('颜色/纹路：', '').trim();
                else if (cleanLine.startsWith('特殊标记：'))
                    result.appearance.specialMarks = cleanLine.replace('特殊标记：', '').trim();
            }
            else if (currentSection === '能力与特征') {
                if (cleanLine.startsWith('攻击方式：'))
                    result.abilities.attack = cleanLine.replace('攻击方式：', '').trim();
                else if (cleanLine.startsWith('防御能力：'))
                    result.abilities.defense = cleanLine.replace('防御能力：', '').trim();
                else if (cleanLine.startsWith('特殊能力：'))
                    result.abilities.special = cleanLine.replace('特殊能力：', '').trim();
                else if (cleanLine.startsWith('弱点：'))
                    result.abilities.weakness = cleanLine.replace('弱点：', '').trim();
            }
            else if (currentSection === '生态与习性') {
                if (cleanLine.startsWith('栖息环境：'))
                    result.ecology.habitat = cleanLine.replace('栖息环境：', '').trim();
                else if (cleanLine.startsWith('行动规律：'))
                    result.ecology.activityPattern = cleanLine.replace('行动规律：', '').trim();
                else if (cleanLine.startsWith('食性：'))
                    result.ecology.diet = cleanLine.replace('食性：', '').trim();
                else if (cleanLine.startsWith('群居属性：'))
                    result.ecology.socialBehavior = cleanLine.replace('群居属性：', '').trim();
            }
            else if (currentSection === '用途与价值') {
                if (cleanLine.startsWith('食用价值：'))
                    result.utility.edible = cleanLine.replace('食用价值：', '').trim();
                else if (cleanLine.startsWith('材料价值：'))
                    result.utility.material = cleanLine.replace('材料价值：', '').trim();
                else if (cleanLine.startsWith('药用价值：'))
                    result.utility.medicinal = cleanLine.replace('药用价值：', '').trim();
                else if (cleanLine.startsWith('其他价值：'))
                    result.utility.other = cleanLine.replace('其他价值：', '').trim();
            }
            else if (currentSection === '已知分布') {
                if (cleanLine.startsWith('主要分布区域：'))
                    result.distribution.mainAreas = cleanLine.replace('主要分布区域：', '').trim();
                else if (cleanLine.startsWith('活动范围边界：'))
                    result.distribution.range = cleanLine.replace('活动范围边界：', '').trim();
                else if (cleanLine.startsWith('与人类活动区域的关系：'))
                    result.distribution.humanRelation = cleanLine.replace('与人类活动区域的关系：', '').trim();
            }
            else if (currentSection === '危险等级历史（动态变化）' && line.trim().startsWith('|')) {
                const cells = line
                    .trim()
                    .split('|')
                    .map(cell => cell.trim())
                    .filter(Boolean);
                if (cells.length >= 5 && /^第\d+章$/.test(cells[0])) {
                    result.dangerLevelHistory.push({
                        chapterNumber: parseInt(cells[0].match(/\d+/)?.[0] || '0', 10),
                        dangerLevel: cells[1],
                        threatLevel: cells[2],
                        protagonistStatus: cells[3],
                        note: cells[4],
                    });
                }
            }
            else if (currentSection === '章节互动记录' && line.trim().startsWith('- ')) {
                result.chapterRecords.push(line.trim().replace(/^-/, '').trim());
            }
        }
        return result;
    }
    renderCreatureCardMarkdown(card) {
        const lines = [
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
    async readCreatureCardDirectory(dirPath) {
        if (!fs_1.default.existsSync(dirPath)) {
            return [];
        }
        const entries = await fs_1.default.promises.readdir(dirPath, { withFileTypes: true });
        const files = entries
            .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
            .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        const cards = [];
        for (const file of files) {
            const filePath = path_1.default.join(dirPath, file.name);
            const rawContent = await (0, utils_1.readFile)(filePath);
            const parsed = this.parseCreatureCardContent(rawContent);
            cards.push({
                name: parsed?.name ?? file.name.replace(/\.md$/i, '').replace(/_/g, ' '),
                content: parsed ? this.renderCreatureCardMarkdown(parsed) : rawContent.trim(),
                path: filePath,
            });
        }
        return cards;
    }
    async readStyleReferenceDirectory(dirPath, skipReadme) {
        if (!fs_1.default.existsSync(dirPath)) {
            return [];
        }
        const entries = await fs_1.default.promises.readdir(dirPath, { withFileTypes: true });
        const files = entries
            .filter(entry => entry.isFile() && entry.name.endsWith('.md') && (!skipReadme || entry.name !== 'README.md'))
            .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        const items = [];
        for (const file of files) {
            const filePath = path_1.default.join(dirPath, file.name);
            const rawContent = await (0, utils_1.readFile)(filePath);
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
    async readChapterPlanEntries(project) {
        const jsonPath = path_1.default.join(project.rootPath, 'planning', 'chapter-plan.json');
        if (fs_1.default.existsSync(jsonPath)) {
            try {
                const content = await (0, utils_1.readFile)(jsonPath);
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map(entry => this.mergeChapterPlanEntry(this.createDefaultChapterPlanEntry(entry.chapterNumber), entry));
                }
            }
            catch {
                // fall through
            }
        }
        const markdown = await this.readChapterPlan(project);
        const parsedEntries = this.parseChapterPlanMarkdown(markdown);
        return parsedEntries.length > 0 ? parsedEntries : this.buildInitialChapterPlanEntries();
    }
    async saveChapterPlanEntries(project, entries) {
        const jsonPath = path_1.default.join(project.rootPath, 'planning', 'chapter-plan.json');
        const normalizedEntries = entries
            .slice()
            .sort((a, b) => a.chapterNumber - b.chapterNumber)
            .map(entry => this.mergeChapterPlanEntry(this.createDefaultChapterPlanEntry(entry.chapterNumber), entry));
        await (0, utils_1.writeFile)(jsonPath, JSON.stringify(normalizedEntries, null, 2) + '\n');
    }
    parseChapterPlanMarkdown(markdown) {
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
    mergeChapterPlanEntry(current, patch) {
        return {
            chapterNumber: patch.chapterNumber,
            title: patch.title?.trim() || current.title || '待定',
            status: patch.status?.trim() || current.status || '待写',
            goal: patch.goal?.trim() || current.goal || EMPTY_TEXT,
            conflict: patch.conflict?.trim() || current.conflict || EMPTY_TEXT,
            note: patch.note?.trim() || current.note || EMPTY_TEXT,
        };
    }
    getThreatLevel(dangerLevel) {
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
exports.ProjectManager = ProjectManager;
