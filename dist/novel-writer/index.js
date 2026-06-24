"use strict";
/**
 * AI Novel Writer - Main entry point
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const context_assembler_1 = require("./context-assembler");
const project_manager_1 = require("./project-manager");
const utils_1 = require("./utils");
const projectManager = new project_manager_1.ProjectManager();
const contextAssembler = new context_assembler_1.ContextAssembler(projectManager);
const VALID_CREATURE_CATEGORIES = ['神话异兽', '野兽', '虫类', '禽类', '鳞类', '植株'];
async function handler(args) {
    const { command, args: positionalArgs, text } = args;
    switch (command) {
        case '新建':
        case 'new':
            await handleNew(text);
            break;
        case '写正文':
        case 'write-draft':
            await handleWriteDraft(positionalArgs, text);
            break;
        case '保存定稿':
        case 'finalize-chapter':
            await handleFinalizeChapter(positionalArgs, text);
            break;
        case '保存章节正文':
        case 'save-chapter':
            await handleSaveChapter(positionalArgs, text);
            break;
        case '保存章节摘要':
        case 'update-summary-done':
            await handleUpdateSummaryDone(positionalArgs, text);
            break;
        case '上下文':
        case 'context-preview':
            await handleContextPreview(positionalArgs, text);
            break;
        case '复盘':
        case 'review-arc':
            await handleReviewArc(positionalArgs);
            break;
        case '帮助':
        case 'help':
        default:
            showHelp();
            break;
    }
}
async function handleNew(text) {
    if (!text) {
        console.log([
            '请提供小说基础信息：',
            '',
            '/novel 新建',
            '# 标题：你的小说名',
            '# 作者：你的名字',
            '# 设定：世界观、背景、主角信息……',
            '# 目录：可选，自定义子目录名',
        ].join('\n'));
        return;
    }
    const titleMatch = text.match(/#.*(?:标题|title)[:：]\s*(.+)/i);
    if (!titleMatch) {
        console.log('错误：必须提供标题，例如 “# 标题：我的小说”。');
        return;
    }
    const title = titleMatch[1].trim();
    const authorMatch = text.match(/#.*(?:作者|author)[:：]\s*(.+)/i);
    const author = authorMatch ? authorMatch[1].trim() : '匿名';
    const settingMatch = text.match(/#.*(?:设定|背景|世界观|setting)[:：]\s*([\s\S]+)/i);
    const setting = settingMatch ? settingMatch[1].trim() : '';
    const projectPath = resolveNewProjectPath(process.cwd(), title, text);
    if (fs_1.default.existsSync(projectPath) && fs_1.default.readdirSync(projectPath).length > 0) {
        console.log(`错误：目标目录已存在且不为空：${projectPath}`);
        return;
    }
    const project = await projectManager.createNewProject(title, author, projectPath, setting);
    console.log([
        '项目创建成功。',
        `标题：${project.title}`,
        `作者：${project.author}`,
        `路径：${project.rootPath}`,
    ].join('\n'));
}
async function handleWriteDraft(args, text) {
    if (!text?.trim()) {
        console.log('请附上本章正文草稿内容。');
        return;
    }
    const parsed = parseChapterCommandArgs(args, text);
    const project = await projectManager.loadProject(process.cwd());
    const targetChapter = parsed.chapterNumber ?? (project.currentChapter + 1);
    const parsedChapter = extractChapterContent(text, targetChapter, parsed.chapterTitle, '');
    const draftPath = await projectManager.saveChapterDraft(project, targetChapter, parsedChapter.title, parsedChapter.content);
    project.pendingChapterDraft = {
        number: targetChapter,
        title: parsedChapter.title,
        prompt: parsed.userPrompt.trim(),
        draftPath,
        draftContent: parsedChapter.content,
        updatedAt: Date.now(),
    };
    await projectManager.upsertChapterPlanEntry(project, {
        chapterNumber: targetChapter,
        title: parsedChapter.title || '待定',
        status: '草稿',
        note: '正文草稿已保存，等待定稿。',
    });
    await projectManager.saveProject(project);
    console.log(`第 ${targetChapter} 章正文草稿已保存。`);
    console.log(`草稿位置：${draftPath}`);
}
async function handleFinalizeChapter(args, text) {
    const parsed = parseChapterCommandArgs(args, text);
    const project = await projectManager.loadProject(process.cwd());
    const targetChapter = parsed.chapterNumber ?? (project.currentChapter + 1);
    const pendingDraft = getPendingDraft(project, targetChapter);
    const finalContent = await resolveFinalChapterContent(project, targetChapter, pendingDraft, text);
    if (!finalContent) {
        console.log('没有找到可用的定稿内容。请先保存正文草稿，或直接附上定稿正文。');
        return;
    }
    const parsedChapter = extractChapterContent(finalContent, targetChapter, parsed.chapterTitle || pendingDraft?.title || '', pendingDraft?.title);
    const chapter = await projectManager.saveChapter(project, targetChapter, parsedChapter.title, parsedChapter.content);
    const autoSummary = generateChapterSummaryFromContent(parsedChapter.content, chapter.number, chapter.title);
    if (pendingDraft) {
        delete project.pendingChapterDraft;
    }
    const { updatedCharacterCardNames, updatedCreatureCardNames } = await syncChapterSummaryAndProjectState(project, chapter, autoSummary);
    console.log(`第 ${chapter.number} 章已定稿并保存到正式章节文件。`);
    console.log(`正式文件：${chapter.contentPath}`);
    console.log('摘要已自动生成并同步到全局摘要、人物关系、时间线、章节计划和相关角色卡。');
    console.log(`摘要已自动生成并同步到全局摘要、人物关系、时间线、章节计划${updatedCharacterCardNames.length > 0 ? `、角色卡（${updatedCharacterCardNames.join('、')}）` : ''}${updatedCreatureCardNames.length > 0 ? `、生物卡（${updatedCreatureCardNames.join('、')}）` : ''}。`);
    console.log('这一章已完成，可以直接开始下一章。');
}
async function handleSaveChapter(args, text) {
    if (!text?.trim()) {
        console.log('用法：/novel 保存章节正文 [章节号] [标题]，并附上完整正文内容。');
        return;
    }
    const parsed = parseChapterCommandArgs(args, text);
    const project = await projectManager.loadProject(process.cwd());
    const targetChapter = parsed.chapterNumber ?? (project.currentChapter + 1);
    const existingChapter = projectManager.getChapter(project, targetChapter);
    const pendingDraft = getPendingDraft(project, targetChapter);
    const parsedChapter = extractChapterContent(text, targetChapter, parsed.chapterTitle, existingChapter?.title || pendingDraft?.title);
    const chapter = await projectManager.saveChapter(project, targetChapter, parsedChapter.title, parsedChapter.content);
    const autoSummary = generateChapterSummaryFromContent(parsedChapter.content, chapter.number, chapter.title);
    if (pendingDraft) {
        delete project.pendingChapterDraft;
    }
    const { updatedCharacterCardNames, updatedCreatureCardNames } = await syncChapterSummaryAndProjectState(project, chapter, autoSummary);
    console.log(`第 ${chapter.number} 章正文已保存。`);
    console.log(`摘要已自动生成并同步到全局摘要、人物关系、时间线、章节计划${updatedCharacterCardNames.length > 0 ? `、角色卡（${updatedCharacterCardNames.join('、')}）` : ''}${updatedCreatureCardNames.length > 0 ? `、生物卡（${updatedCreatureCardNames.join('、')}）` : ''}。`);
}
async function handleUpdateSummaryDone(args, text) {
    if (!text?.trim()) {
        console.log('请提供生成好的章节摘要内容。');
        return;
    }
    const chapterNumberFromArgs = args.length > 0 && !isNaN(parseInt(args[0], 10))
        ? parseInt(args[0], 10)
        : undefined;
    const project = await projectManager.loadProject(process.cwd());
    const chapterNumber = chapterNumberFromArgs ?? project.currentChapter;
    const chapter = projectManager.getChapter(project, chapterNumber);
    if (!chapter) {
        console.log(`找不到第 ${chapterNumber} 章。`);
        return;
    }
    const { updatedCharacterCardNames, updatedCreatureCardNames } = await syncChapterSummaryAndProjectState(project, chapter, text.trim());
    console.log(`已保存第 ${chapterNumber} 章摘要，并自动更新全局摘要、人物关系、时间线、章节计划${updatedCharacterCardNames.length > 0 ? `、角色卡（${updatedCharacterCardNames.join('、')}）` : ''}${updatedCreatureCardNames.length > 0 ? `、生物卡（${updatedCreatureCardNames.join('、')}）` : ''}。`);
}
async function handleContextPreview(args, text) {
    const project = await projectManager.loadProject(process.cwd());
    const chapterNumber = args.length > 0 && !isNaN(parseInt(args[0], 10))
        ? parseInt(args[0], 10)
        : project.currentChapter + 1;
    const context = await contextAssembler.assembleContext(project, chapterNumber, text?.trim() || '');
    console.log([
        '上下文准备完成，Token 估算：',
        `  全局摘要：${estimateTextTokens(context.globalSummary)} tokens`,
        `  最近章节摘要：${context.recentChapterSummaries.reduce((sum, item) => sum + estimateTextTokens(item.summary), 0)} tokens`,
        `  最近完整内容：${context.recentFullContents.reduce((sum, item) => sum + estimateTextTokens(item.content), 0)} tokens`,
        `  角色卡：${context.characterCards.reduce((sum, item) => sum + estimateTextTokens(item.content), 0)} tokens`,
        `  生物卡：${context.creatureCards.reduce((sum, item) => sum + estimateTextTokens(item.content), 0)} tokens`,
        `  总计：${context.estimatedTokens} tokens`,
        '',
        '全局摘要：',
        context.globalSummary || '(暂无)',
        '',
        '最近章节摘要：',
        context.recentChapterSummaries.map(item => `- 第${item.number}章：${item.summary}`).join('\n') || '(暂无)',
    ].join('\n'));
}
async function handleReviewArc(args) {
    const project = await projectManager.loadProject(process.cwd());
    const start = args.length > 0 && !isNaN(parseInt(args[0], 10)) ? parseInt(args[0], 10) : 1;
    const end = args.length > 1 && !isNaN(parseInt(args[1], 10)) ? parseInt(args[1], 10) : project.currentChapter;
    const summaries = [];
    for (let chapterNumber = start; chapterNumber <= end; chapterNumber += 1) {
        const chapter = projectManager.getChapter(project, chapterNumber);
        if (!chapter) {
            continue;
        }
        const summary = (await projectManager.readChapterSummary(chapter)).trim();
        if (summary) {
            summaries.push(`## 第${chapterNumber}章\n${summary}`);
        }
    }
    console.log([
        `阶段复盘（第${start}章 - 第${end}章）`,
        '',
        summaries.join('\n\n') || '(暂无摘要)',
    ].join('\n'));
}
async function syncChapterSummaryAndProjectState(project, chapter, chapterSummary) {
    await projectManager.saveChapterSummary(chapter, chapterSummary);
    const [globalSummary, characterRelationships, timeline, characterCards, allCreatureCards, chapterContent] = await Promise.all([
        projectManager.readGlobalSummary(project),
        projectManager.readCharacterRelationships(project),
        projectManager.readTimeline(project),
        projectManager.readCharacterCards(project),
        projectManager.readAllCreatureCards(project),
        projectManager.readChapterContent(chapter),
    ]);
    const extractedNames = extractCharacterNames(chapterSummary, characterCards.map(card => card.name));
    const updatedGlobalSummary = autoUpdateGlobalSummary(globalSummary, chapter.number, chapter.title, chapterSummary);
    const updatedRelationships = autoUpdateCharacterRelationships(characterRelationships, chapter.number, chapter.title, chapterSummary, extractedNames);
    const updatedTimeline = autoUpdateTimeline(timeline, chapter.number, chapter.title, chapterSummary, extractedNames);
    await Promise.all([
        projectManager.saveGlobalSummary(project, updatedGlobalSummary),
        projectManager.saveCharacterRelationships(project, updatedRelationships),
        projectManager.saveTimeline(project, updatedTimeline),
    ]);
    const updatedCharacterCardNames = await autoUpdateCharacterCards(project, characterCards, chapter.number, chapter.title, chapterSummary, extractedNames);
    const creatureNames = extractCreatureNames(chapterSummary, chapterContent, allCreatureCards.map(card => card.name));
    const updatedCreatureCardNames = await autoUpdateCreatureCards(project, chapter, chapterSummary, creatureNames);
    await projectManager.upsertChapterPlanEntry(project, {
        chapterNumber: chapter.number,
        title: chapter.title || '待定',
        status: '已完成',
        goal: summarizeForLine(chapterSummary, 50),
        conflict: '已在正文中展开',
        note: `摘要与全局资料已自动同步${updatedCharacterCardNames.length > 0 ? `，角色卡：${updatedCharacterCardNames.join('、')}` : ''}${updatedCreatureCardNames.length > 0 ? `，生物卡：${updatedCreatureCardNames.join('、')}` : ''}。`,
    });
    await projectManager.saveProject(project);
    return { updatedCharacterCardNames, updatedCreatureCardNames };
}
async function autoUpdateCharacterCards(project, existingCards, chapterNumber, chapterTitle, chapterSummary, extractedNames) {
    const existingByName = new Map(existingCards.map(card => [card.name, card.content]));
    const updated = [];
    for (const name of extractedNames) {
        const current = existingByName.get(name) || buildNewCharacterCard(name, chapterNumber, chapterTitle, chapterSummary);
        await projectManager.saveCharacterCard(project, name, appendChapterNote(current, chapterNumber, chapterTitle, chapterSummary));
        updated.push(name);
    }
    return Array.from(new Set(updated));
}
async function autoUpdateCreatureCards(project, chapter, chapterSummary, extractedCreatureNames) {
    if (extractedCreatureNames.length === 0) {
        return [];
    }
    const updatedNames = [];
    for (const creatureName of extractedCreatureNames) {
        if (creatureName.length < 2 || creatureName.length > 6) {
            continue;
        }
        let found = await projectManager.findCreatureCard(project, creatureName);
        if (!found) {
            await autoCreateCreatureCard(project, creatureName, chapter.number, chapter.title, chapterSummary);
            found = await projectManager.findCreatureCard(project, creatureName);
        }
        if (!found) {
            continue;
        }
        await projectManager.appendCreatureChapterRecord(project, found.category, found.card.name, chapter.number, chapter.title, summarizeForLine(chapterSummary, 80));
        updatedNames.push(found.card.name);
    }
    return Array.from(new Set(updatedNames));
}
function buildNewCharacterCard(name, chapterNumber, chapterTitle, chapterSummary) {
    return [
        `# ${name}`,
        '',
        '## 基础信息',
        '- 身份：待补充',
        '- 立场：待补充',
        `- 首次出场：第${chapterNumber}章${chapterTitle ? `《${chapterTitle}》` : ''}`,
        '',
        '## 最近章节记录',
        `- 第${chapterNumber}章${chapterTitle ? ` ${chapterTitle}` : ''}：${summarizeForLine(chapterSummary, 80)}`,
    ].join('\n');
}
function extractCharacterNames(summary, existingNames) {
    const names = new Set();
    for (const name of existingNames) {
        if (name && summary.includes(name)) {
            names.add(name);
        }
    }
    const regex = /[\u4e00-\u9fa5]{2,4}/g;
    const reserved = new Set(['本章', '摘要', '主角', '众人', '他们', '自己', '危险', '角色卡', '生物卡']);
    for (const match of summary.match(regex) || []) {
        if (!reserved.has(match)) {
            names.add(match);
        }
    }
    return Array.from(names).filter(name => name.length >= 2 && name.length <= 4).slice(0, 8);
}
function autoUpdateGlobalSummary(currentGlobalSummary, chapterNumber, chapterTitle, chapterSummary) {
    const parsed = (0, utils_1.parseGlobalSummary)(currentGlobalSummary || '');
    const summaryLine = `第${chapterNumber}章${chapterTitle ? `《${chapterTitle}》` : ''}：${summarizeForLine(chapterSummary, 120)}`;
    const mainPlotParts = normalizeListLikeBlock(parsed.mainPlot);
    if (!mainPlotParts.includes(summaryLine)) {
        mainPlotParts.push(summaryLine);
    }
    parsed.mainPlot = mainPlotParts.join('\n');
    parsed.completedArcs = normalizeStringArray(parsed.completedArcs);
    if (!parsed.completedArcs.includes(summaryLine)) {
        parsed.completedArcs.push(summaryLine);
    }
    return withTitle(currentGlobalSummary, (0, utils_1.serializeGlobalSummary)(parsed), extractDocumentTitle(currentGlobalSummary, '全局摘要'));
}
function autoUpdateCharacterRelationships(currentRelationships, chapterNumber, chapterTitle, chapterSummary, extractedNames) {
    let output = ensureSectionContent(currentRelationships || '# 人物关系', '主要人物', mergeBulletNames(getSectionContent(currentRelationships, '主要人物'), extractedNames));
    output = ensureSectionContent(output, '当前状态', appendBulletLine(getSectionContent(output, '当前状态'), `第${chapterNumber}章${chapterTitle ? `《${chapterTitle}》` : ''}：${summarizeForLine(chapterSummary, 120)}`));
    return output.trim() + '\n';
}
function autoUpdateTimeline(currentTimeline, chapterNumber, chapterTitle, chapterSummary, extractedNames) {
    const base = currentTimeline.trim() || [
        '# 时间线',
        '',
        '## 当前故事时间线',
        '',
        '| 序号 | 时间/时段 | 章节 | 地点 | 事件 | 涉及人物 |',
        '| --- | --- | --- | --- | --- | --- |',
    ].join('\n');
    const lines = base.split(/\r?\n/);
    const newRow = `| ${findNextTimelineIndex(lines)} | 第${chapterNumber}章 | 第${chapterNumber}章 ${chapterTitle || ''} | 待补 | ${escapeTableCell(summarizeForLine(chapterSummary, 60))} | ${escapeTableCell(extractedNames.join('、') || '待补')} |`;
    if (!lines.some(line => line.includes(`| 第${chapterNumber}章 |`) || line.includes(`第${chapterNumber}章 ${chapterTitle || ''}`))) {
        lines.push(newRow);
    }
    return lines.join('\n').trim() + '\n';
}
function generateChapterSummaryFromContent(chapterContent, chapterNumber, chapterTitle) {
    const cleaned = chapterContent
        .replace(/^#.*$/gm, '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    const firstParagraph = cleaned[0] || '';
    const middleParagraph = cleaned[Math.floor(cleaned.length / 2)] || '';
    const lastParagraph = cleaned[cleaned.length - 1] || '';
    const summaryLines = Array.from(new Set([firstParagraph, middleParagraph, lastParagraph].filter(Boolean)))
        .slice(0, 3)
        .map(part => `- ${summarizeForLine(part, 90)}`);
    return [
        `# 第${chapterNumber}章${chapterTitle ? ` ${chapterTitle}` : ''}摘要`,
        '',
        '## 本章事件',
        summaryLines.join('\n') || '- （待补充）',
        '',
        '## 简述',
        summarizeForLine(cleaned.join(' '), 180) || '（待补充）',
    ].join('\n');
}
async function resolveFinalChapterContent(project, chapterNumber, pendingDraft, inlineText) {
    if (inlineText?.trim()) {
        return inlineText.trim();
    }
    if (pendingDraft?.draftPath && fs_1.default.existsSync(pendingDraft.draftPath)) {
        return (await (0, utils_1.readFile)(pendingDraft.draftPath)).trim();
    }
    const fallbackDraftPath = path_1.default.join(project.rootPath, 'chapters', 'drafts', `${(0, utils_1.formatChapterNumber)(chapterNumber)}-draft.md`);
    if (fs_1.default.existsSync(fallbackDraftPath)) {
        return (await (0, utils_1.readFile)(fallbackDraftPath)).trim();
    }
    return pendingDraft?.draftContent?.trim() || '';
}
function extractChapterContent(rawContent, chapterNumber, explicitTitle, existingTitle) {
    const trimmedContent = rawContent.trim();
    const lines = trimmedContent.split(/\r?\n/);
    const headingLine = lines[0]?.match(/^#+\s*(.+)$/)?.[1]?.trim();
    let title = explicitTitle.trim() || existingTitle?.trim() || '';
    let content = trimmedContent;
    if (headingLine) {
        const zhMatch = headingLine.match(new RegExp(`^第\\s*${chapterNumber}\\s*章\\s*(.*)$`));
        const enMatch = headingLine.match(new RegExp(`^(?:Chapter|chapter)\\s*${chapterNumber}\\s*(.*)$`));
        title = title || zhMatch?.[1]?.trim() || enMatch?.[1]?.trim() || headingLine;
        content = lines.slice(1).join('\n').trim();
    }
    return { title, content };
}
function parseChapterCommandArgs(args, text) {
    let chapterNumber;
    let chapterTitle = '';
    let userPrompt = text ?? args.join(' ');
    if (args.length > 0 && !isNaN(parseInt(args[0], 10))) {
        chapterNumber = parseInt(args[0], 10);
        if (text === undefined) {
            userPrompt = args.slice(1).join(' ');
        }
        else {
            chapterTitle = args.slice(1).join(' ').trim();
        }
    }
    else if (text !== undefined) {
        chapterTitle = args.join(' ').trim();
    }
    return { chapterNumber, chapterTitle, userPrompt };
}
function getPendingDraft(project, chapterNumber) {
    return project.pendingChapterDraft?.number === chapterNumber ? project.pendingChapterDraft : undefined;
}
function estimateTextTokens(text) {
    return Math.ceil((text || '').length / 1.5);
}
function summarizeForLine(text, maxLength) {
    const singleLine = text.replace(/\s+/g, ' ').trim();
    if (singleLine.length <= maxLength) {
        return singleLine;
    }
    return `${singleLine.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}
function appendChapterNote(content, chapterNumber, chapterTitle, chapterSummary) {
    const note = `- 第${chapterNumber}章${chapterTitle ? ` ${chapterTitle}` : ''}：${summarizeForLine(chapterSummary, 80)}`;
    const sectionContent = getSectionContent(content, '最近章节记录');
    return ensureSectionContent(content, '最近章节记录', appendBulletLine(sectionContent, note));
}
function mergeBulletNames(content, names) {
    const existing = new Set((content || '')
        .split(/\r?\n/)
        .map(line => line.replace(/^[*-]\s*/, '').trim())
        .filter(Boolean)
        .filter(line => line !== '(暂无)'));
    for (const name of names) {
        existing.add(name);
    }
    const lines = Array.from(existing).filter(Boolean).map(item => `- ${item}`);
    return lines.length > 0 ? lines.join('\n') : '(暂无)';
}
function appendBulletLine(content, line) {
    const normalized = content.trim();
    const lines = normalized && normalized !== '(暂无)' ? normalized.split(/\r?\n/).filter(Boolean) : [];
    if (!lines.some(item => item.includes(line))) {
        lines.push(line.startsWith('- ') ? line : `- ${line}`);
    }
    return lines.join('\n') || '(暂无)';
}
function getSectionContent(document, heading) {
    const regex = new RegExp(`##\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`);
    const match = (document || '').match(regex);
    return match?.[1]?.trim() || '(暂无)';
}
function ensureSectionContent(document, heading, content) {
    const normalizedContent = content.trim() || '(暂无)';
    const normalizedDocument = (document || '').trim();
    const regex = new RegExp(`##\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`);
    if (regex.test(normalizedDocument)) {
        return normalizedDocument.replace(regex, `## ${heading}\n${normalizedContent}\n`);
    }
    return `${normalizedDocument || '# 文档'}\n\n## ${heading}\n${normalizedContent}\n`;
}
function findNextTimelineIndex(lines) {
    const values = lines
        .map(line => line.match(/^\|\s*(\d+)\s*\|/)?.[1])
        .map(value => Number(value || 0))
        .filter(value => Number.isFinite(value) && value > 0);
    return (values.length > 0 ? Math.max(...values) : 0) + 1;
}
function escapeTableCell(value) {
    return value.replace(/\|/g, '¦');
}
function extractDocumentTitle(content, fallback) {
    const match = (content || '').match(/^#\s+(.+)$/m);
    return match?.[1]?.trim() || fallback;
}
function withTitle(original, body, title) {
    return `# ${title}\n\n${body.trim()}\n`;
}
function normalizeListLikeBlock(content) {
    return (content || '')
        .split(/\r?\n/)
        .map(line => line.replace(/^[*-]\s*/, '').trim())
        .filter(Boolean)
        .filter(line => line !== '(暂无)');
}
function normalizeStringArray(values) {
    return (values || []).map(item => item.trim()).filter(Boolean);
}
function resolveNewProjectPath(workspacePath, title, rawText) {
    const directoryMatch = rawText.match(/#.*(?:目录|dir|directory)[:：]\s*(.+)/i);
    const requestedDirectory = directoryMatch?.[1]?.trim();
    const baseName = requestedDirectory || title;
    return path_1.default.join(workspacePath, '小说管理', sanitizeDirectoryName(baseName));
}
function sanitizeDirectoryName(input) {
    const sanitized = input
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '-')
        .replace(/_+/g, '_')
        .replace(/^[._-]+|[._-]+$/g, '');
    return sanitized || 'novel-project';
}
function extractCreatureNames(chapterSummary, chapterContent, existingNames = []) {
    return (0, utils_1.extractLikelyCreatureNames)(`${chapterSummary}\n${chapterContent}`, existingNames);
}
function inferCreatureCategory(creatureName) {
    const name = creatureName.toLowerCase();
    if (/(?:草|芝|花|树|木|枝|叶|藤|蔓|果|根|竹|苔|藓|莲|荷|梅|兰|菊|槐|松|柏|柳|桃|桑|榕|榆)/.test(name)) {
        return '植株';
    }
    if (/(?:鸟|雀|鹰|鸽|鸦|凤|凰|鹤|鹞|鸢|燕)/.test(name)) {
        return '禽类';
    }
    if (/(?:虫|蝎|蜈|蛛|蚁|蜂|蝶|蛾|蚊|蝉|蟾)/.test(name)) {
        return '虫类';
    }
    if (/(?:鱼|鳞|鲨|鲸|鲤|鲫|鳄|蛇|蟒|蛟)/.test(name)) {
        return '鳞类';
    }
    if (/(?:虎|狮|狼|豹|熊|猿|猴|狐|兔|鼠|鹿|貂|狸|犬|猫)/.test(name)) {
        return '野兽';
    }
    if (/(?:龙|凤|麒麟|白虎|玄武|朱雀|神|仙|妖|魔|鬼|怪|精|灵)/.test(name)) {
        return '神话异兽';
    }
    return '植株';
}
function calculateDangerLevelByChapter(chapterNumber) {
    if (chapterNumber >= 20)
        return '无害';
    if (chapterNumber >= 15)
        return '低';
    if (chapterNumber >= 10)
        return '中';
    if (chapterNumber >= 5)
        return '高';
    return '极高';
}
async function autoCreateCreatureCard(project, creatureName, chapterNumber, chapterTitle, chapterSummary) {
    const category = inferCreatureCategory(creatureName);
    if (!VALID_CREATURE_CATEGORIES.includes(category)) {
        return;
    }
    const card = projectManager.buildDefaultCreatureCard(creatureName, category, `第${chapterNumber}章${chapterTitle ? `《${chapterTitle}》` : ''}`, calculateDangerLevelByChapter(chapterNumber));
    card.chapterRecords.push(`第${chapterNumber}章${chapterTitle ? ` ${chapterTitle}` : ''}：${summarizeForLine(chapterSummary, 80)}`);
    await projectManager.saveCreatureCardFromObject(project, category, creatureName, card);
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function showHelp() {
    console.log([
        '可用命令：',
        '- /novel 新建',
        '- /novel 写正文',
        '- /novel 保存定稿',
        '- /novel 保存章节正文',
        '- /novel 保存章节摘要',
        '- /novel 上下文',
        '- /novel 复盘',
    ].join('\n'));
}
module.exports = {
    name: 'novel',
    description: 'AI 辅助长篇小说写作，并自动维护摘要、时间线、角色卡和生物卡。',
    handler,
};
