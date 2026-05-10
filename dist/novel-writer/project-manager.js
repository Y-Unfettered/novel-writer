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
        await (0, utils_1.writeFile)(path_1.default.join(rootPath, 'global-summary.md'), this.buildInitialGlobalSummary(title, basicSetting));
        await (0, utils_1.writeFile)(path_1.default.join(rootPath, 'characters', '人物关系.md'), this.buildInitialCharacterRelationships());
        await (0, utils_1.writeFile)(path_1.default.join(rootPath, 'characters', 'cards', 'README.md'), this.buildInitialCharacterCardGuide());
        await (0, utils_1.writeFile)(path_1.default.join(rootPath, 'planning', 'timeline.md'), this.buildInitialTimeline());
        const chapterPlanEntries = this.buildInitialChapterPlanEntries();
        await (0, utils_1.writeFile)(path_1.default.join(rootPath, 'planning', 'chapter-plan.md'), this.renderChapterPlanMarkdown(chapterPlanEntries));
        await (0, utils_1.writeFile)(path_1.default.join(rootPath, 'planning', 'chapter-plan.json'), JSON.stringify(chapterPlanEntries, null, 2) + '\n');
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
        if (chapterNumber > project.currentChapter) {
            project.currentChapter = chapterNumber;
        }
        await this.saveProject(project);
        return chapterInfo;
    }
    async saveChapterDraft(project, chapterNumber, chapterTitle, content) {
        const formattedNum = (0, utils_1.formatChapterNumber)(chapterNumber);
        const draftsDir = path_1.default.join(project.rootPath, 'chapters', 'drafts');
        const draftPath = path_1.default.join(draftsDir, `${formattedNum}-draft.md`);
        await (0, utils_1.ensureDir)(draftsDir);
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
        await (0, utils_1.writeFile)(chapter.summaryPath, summary);
    }
    async readGlobalSummary(project) {
        const filePath = path_1.default.join(project.rootPath, 'global-summary.md');
        return fs_1.default.existsSync(filePath) ? (0, utils_1.readFile)(filePath) : '';
    }
    async saveGlobalSummary(project, summary) {
        await (0, utils_1.writeFile)(path_1.default.join(project.rootPath, 'global-summary.md'), summary);
    }
    async readCharacterRelationships(project) {
        const filePath = path_1.default.join(project.rootPath, 'characters', '人物关系.md');
        return fs_1.default.existsSync(filePath) ? (0, utils_1.readFile)(filePath) : '';
    }
    async saveCharacterRelationships(project, content) {
        await (0, utils_1.writeFile)(path_1.default.join(project.rootPath, 'characters', '人物关系.md'), content);
    }
    async readTimeline(project) {
        const filePath = path_1.default.join(project.rootPath, 'planning', 'timeline.md');
        return fs_1.default.existsSync(filePath) ? (0, utils_1.readFile)(filePath) : '';
    }
    async saveTimeline(project, content) {
        await (0, utils_1.writeFile)(path_1.default.join(project.rootPath, 'planning', 'timeline.md'), content);
    }
    async readChapterPlan(project) {
        const filePath = path_1.default.join(project.rootPath, 'planning', 'chapter-plan.md');
        return fs_1.default.existsSync(filePath) ? (0, utils_1.readFile)(filePath) : '';
    }
    async saveChapterPlan(project, content) {
        await (0, utils_1.writeFile)(path_1.default.join(project.rootPath, 'planning', 'chapter-plan.md'), content);
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
        const fileName = `${this.sanitizeFileName(name)}.md`;
        const filePath = path_1.default.join(project.rootPath, 'characters', 'cards', fileName);
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
        const fileName = this.buildStyleReferenceFileName(category, name);
        const filePath = path_1.default.join(project.rootPath, 'references', 'raw', fileName);
        await (0, utils_1.writeFile)(filePath, this.wrapStyleReferenceContent(category, name, content));
        return filePath;
    }
    async saveStyleReferenceCard(project, category, name, content) {
        const fileName = this.buildStyleReferenceFileName(category, name);
        const filePath = path_1.default.join(project.rootPath, 'references', 'cards', fileName);
        await (0, utils_1.writeFile)(filePath, this.wrapStyleReferenceContent(category, name, content));
        return filePath;
    }
    async createProjectSnapshot(project, label) {
        const timestamp = this.buildSnapshotTimestamp();
        const safeLabel = label?.trim() ? `-${this.sanitizeFileName(label.trim())}` : '';
        const snapshotRoot = path_1.default.join(project.rootPath, 'snapshots', `${timestamp}${safeLabel}`);
        await (0, utils_1.ensureDir)(snapshotRoot);
        const targets = ['novel.json', 'global-summary.md', 'chapters', 'characters', 'planning', 'references'];
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
    buildInitialGlobalSummary(title, setting) {
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
    buildInitialCharacterRelationships() {
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
    buildInitialCharacterCardGuide() {
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
    buildInitialTimeline() {
        return `# 时间线

## 远期背景

(暂无)

## 当前故事时间线

| 序号 | 时间/时段 | 章节 | 地点 | 事件 | 涉及人物 |
| --- | --- | --- | --- | --- | --- |
| 1 | 待定 | 待定 | 待定 | (暂无) | (暂无) |
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
            goal: '(暂无)',
            conflict: '(暂无)',
            note: '(暂无)',
        };
    }
    buildInitialChapterPlan() {
        return this.renderChapterPlanMarkdown(this.buildInitialChapterPlanEntries());
    }
    renderChapterPlanMarkdown(entries) {
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
    buildInitialStyleReferenceGuide() {
        return `# 风格参考库说明

这里存放你自己的参考写法卡片，而不是直接把长篇原文塞进上下文。

建议流程：
1. 把喜欢的环境描写、人物描写、打斗描写原文放进 references/raw
2. 提炼成短小的“风格卡”放进 references/cards
3. 写作时在要点里写：调用风格：环境,人物,打斗

风格卡建议包含：适用场景、节奏特点、句式特点、感官重点、禁忌、可借鉴技巧。
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
    buildSnapshotTimestamp() {
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
        return {
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
    }
    toStoredProject(project) {
        return {
            ...project,
            config: {
                ...types_1.DEFAULT_CONFIG,
                ...(project.config ?? {}),
            },
            rootPath: '.',
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
    wrapStyleReferenceContent(category, name, content) {
        const metadata = JSON.stringify({ category, name });
        return `<!-- novel-style-meta: ${metadata} -->\n${content.trim()}\n`;
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
            return {
                category: metadata.category,
                name: metadata.name,
                content: match[2].trim(),
            };
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
            return {
                name: metadata.name,
                content: match[2].trim(),
            };
        }
        catch {
            return null;
        }
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
                    return parsed
                        .filter(entry => Number.isFinite(entry.chapterNumber))
                        .sort((a, b) => a.chapterNumber - b.chapterNumber);
                }
            }
            catch {
                // Fall through to markdown parsing.
            }
        }
        const markdown = await this.readChapterPlan(project);
        const parsedFromMarkdown = this.parseChapterPlanMarkdown(markdown);
        return parsedFromMarkdown.length > 0 ? parsedFromMarkdown : this.buildInitialChapterPlanEntries();
    }
    async saveChapterPlanEntries(project, entries) {
        const normalizedEntries = entries
            .slice()
            .sort((a, b) => a.chapterNumber - b.chapterNumber);
        await (0, utils_1.writeFile)(path_1.default.join(project.rootPath, 'planning', 'chapter-plan.json'), JSON.stringify(normalizedEntries, null, 2) + '\n');
    }
    parseChapterPlanMarkdown(content) {
        const entries = [];
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
    mergeChapterPlanEntry(current, patch) {
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
exports.ProjectManager = ProjectManager;
