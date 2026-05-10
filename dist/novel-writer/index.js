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
const content_generator_1 = require("./content-generator");
const context_assembler_1 = require("./context-assembler");
const project_manager_1 = require("./project-manager");
const summary_updater_1 = require("./summary-updater");
const utils_1 = require("./utils");
const SKILL_ROOT = path_1.default.dirname(__filename);
const projectManager = new project_manager_1.ProjectManager();
const summaryUpdater = new summary_updater_1.SummaryUpdater(SKILL_ROOT);
const contextAssembler = new context_assembler_1.ContextAssembler(projectManager);
const contentGenerator = new content_generator_1.ContentGenerator(contextAssembler, summaryUpdater);
async function handler(args) {
    const { command, args: positionalArgs, text } = args;
    switch (command) {
        case '新建':
        case 'new':
            await handleNew(text);
            break;
        case '规划章节':
        case 'plan-chapter':
            await handlePlanChapter(positionalArgs, text);
            break;
        case '确认章节':
        case 'confirm-chapter':
            await handleConfirmChapter(positionalArgs, text);
            break;
        case '写正文':
        case 'write-draft':
            await handleWriteDraft(positionalArgs, text);
            break;
        case '保存定稿':
        case 'finalize-chapter':
            await handleFinalizeChapter(positionalArgs, text);
            break;
        case '续写':
        case 'continue':
            await handleContinue(positionalArgs, text);
            break;
        case '保存章节正文':
        case 'save-chapter':
            await handleSaveChapter(positionalArgs, text);
            break;
        case '更新摘要':
        case 'update-summary':
            await handleUpdateSummary(positionalArgs);
            break;
        case '保存章节摘要':
        case 'update-summary-done':
            await handleUpdateSummaryDone(positionalArgs, text);
            break;
        case '保存全局摘要':
        case 'apply-global-summary':
            await handleApplyGlobalSummary(text);
            break;
        case '保存人物关系':
            await handleApplyCharacterRelationships(text);
            break;
        case '保存角色卡':
        case 'save-character-card':
            await handleSaveCharacterCard(positionalArgs, text);
            break;
        case '保存时间线':
        case 'save-timeline':
            await handleSaveTimeline(text);
            break;
        case '保存章节计划':
        case 'save-chapter-plan':
            await handleSaveChapterPlan(text);
            break;
        case '快照':
        case 'snapshot':
            await handleSnapshot(positionalArgs);
            break;
        case '保存素材':
            await handleSaveStyleMaterial(positionalArgs, text);
            break;
        case '保存风格卡':
            await handleSaveStyleCard(positionalArgs, text);
            break;
        case '分析素材':
            await handleAnalyzeStyleMaterial(positionalArgs);
            break;
        case '状态':
        case 'status':
            await handleStatus();
            break;
        case '人物关系':
        case '人物':
            await handleReadCharacterRelationships();
            break;
        case '角色卡':
        case 'character-cards':
            await handleReadCharacterCards(positionalArgs);
            break;
        case '时间线':
        case 'timeline':
            await handleReadTimeline();
            break;
        case '章节计划':
        case 'plan':
            await handleReadChapterPlan();
            break;
        case '跳章':
        case '跳转':
        case 'jump':
            await handleJump(positionalArgs, text);
            break;
        case '阅读':
        case 'read':
            await handleRead(positionalArgs);
            break;
        case '风格库':
            await handleReadStyleLibrary();
            break;
        case '压缩':
        case 'compress':
            await handleCompress();
            break;
        case '重建资料':
            await handleRebuildProjectState();
            break;
        case '自检':
        case 'consistency-check':
            await handleConsistencyCheck(positionalArgs);
            break;
        case '复盘':
        case 'review-arc':
            await handleReviewArc(positionalArgs);
            break;
        case '规划下一章':
        case 'plan-next':
            await handlePlanNextChapter(positionalArgs, text);
            break;
        case '上下文':
        case 'context-preview':
            await handleContextPreview(positionalArgs, text);
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
    const workspacePath = process.cwd();
    const projectPath = resolveNewProjectPath(workspacePath, title, text);
    if (fs_1.default.existsSync(projectPath)) {
        const existingEntries = fs_1.default.readdirSync(projectPath);
        if (existingEntries.length > 0) {
            console.log(`错误：目标目录已存在且不为空：${projectPath}`);
            return;
        }
    }
    console.log(`正在创建小说项目 "${title}" 于 ${projectPath} ...`);
    try {
        const project = await projectManager.createNewProject(title, author, projectPath, setting);
        console.log([
            '项目创建成功。',
            `标题：${project.title}`,
            `作者：${project.author}`,
            `路径：${project.rootPath}`,
            '',
            `进入目录：cd "${project.rootPath}"`,
            '下一步：/novel 续写 [章节标题] <要点>',
        ].join('\n'));
    }
    catch (error) {
        console.error('创建项目失败：', error.message);
    }
}
async function handlePlanChapter(args, text) {
    const parsed = parseChapterCommandArgs(args, text);
    const userPrompt = parsed.userPrompt.trim();
    if (!userPrompt) {
        console.log('请提供本章想写的内容、重点冲突和预期效果。');
        return;
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        const targetChapter = parsed.chapterNumber ?? (project.currentChapter + 1);
        const persistedTitle = parsed.chapterTitle || projectManager.getChapter(project, targetChapter)?.title || '';
        project.pendingChapterDraft = buildPendingDraft(targetChapter, persistedTitle, userPrompt);
        await projectManager.upsertChapterPlanEntry(project, {
            chapterNumber: targetChapter,
            title: persistedTitle || '待定',
            status: '待确认',
            note: '已记录本章需求，等待确认章节方案。',
        });
        await projectManager.saveProject(project);
        console.log([
            `已记录第 ${targetChapter} 章的创作要求。`,
            persistedTitle ? `暂定标题：${persistedTitle}` : '暂定标题：待定',
            '',
            '下一步不是直接写正文，而是先整理章节方案给你确认。',
            '建议确认内容：',
            '1. 本章目标',
            '2. 关键冲突',
            '3. 角色出场与关系变化',
            '4. 伏笔 / 信息揭示',
            '5. 章节结尾钩子',
            '',
            `确认完成后，执行：/novel 确认章节 ${targetChapter}${persistedTitle ? ` ${persistedTitle}` : ''}`,
        ].join('\n'));
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleConfirmChapter(args, text) {
    const parsed = parseChapterCommandArgs(args, text);
    const confirmedOutline = parsed.userPrompt.trim();
    if (!confirmedOutline) {
        console.log('请提供确认后的章节方案。');
        return;
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        const targetChapter = parsed.chapterNumber ?? (project.currentChapter + 1);
        const pendingDraft = getPendingDraft(project, targetChapter);
        const chapterTitle = parsed.chapterTitle || pendingDraft?.title || projectManager.getChapter(project, targetChapter)?.title || '';
        project.pendingChapterDraft = {
            number: targetChapter,
            title: chapterTitle.trim(),
            prompt: pendingDraft?.prompt?.trim() || '',
            confirmedOutline,
            draftPath: pendingDraft?.draftPath,
            draftContent: pendingDraft?.draftContent,
            updatedAt: Date.now(),
        };
        await projectManager.upsertChapterPlanEntry(project, {
            chapterNumber: targetChapter,
            title: chapterTitle || '待定',
            status: '待写正文',
            note: '章节方案已确认，可以开始写正文。',
        });
        await projectManager.saveProject(project);
        console.log([
            `第 ${targetChapter} 章方案已确认。`,
            '下一步由助手直接生成正文并落草稿文件。',
            `执行：/novel 写正文 ${targetChapter}${chapterTitle ? ` ${chapterTitle}` : ''}`,
        ].join('\n'));
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleWriteDraft(args, text) {
    const parsed = parseChapterCommandArgs(args, text);
    try {
        const project = await projectManager.loadProject(process.cwd());
        const targetChapter = parsed.chapterNumber ?? (project.currentChapter + 1);
        const pendingDraft = getPendingDraft(project, targetChapter);
        const chapterTitle = parsed.chapterTitle || pendingDraft?.title || projectManager.getChapter(project, targetChapter)?.title || '';
        if (text?.trim()) {
            const parsedChapter = extractChapterContent(text, targetChapter, chapterTitle, pendingDraft?.title);
            const draftPath = await projectManager.saveChapterDraft(project, targetChapter, parsedChapter.title, parsedChapter.content);
            project.pendingChapterDraft = {
                number: targetChapter,
                title: parsedChapter.title,
                prompt: pendingDraft?.prompt?.trim() || parsed.userPrompt.trim(),
                confirmedOutline: pendingDraft?.confirmedOutline,
                draftPath,
                draftContent: parsedChapter.content,
                updatedAt: Date.now(),
            };
            await projectManager.upsertChapterPlanEntry(project, {
                chapterNumber: targetChapter,
                title: parsedChapter.title || '待定',
                status: '待审稿',
                note: '正文草稿已落盘，等待审稿和修改。',
            });
            await projectManager.saveProject(project);
            console.log([
                `第 ${targetChapter} 章正文草稿已保存。`,
                `草稿位置：${draftPath}`,
                '请直接在草稿文件里审稿和修改。',
                `确认定稿后，执行：/novel 保存定稿 ${targetChapter}${parsedChapter.title ? ` ${parsedChapter.title}` : ''}`,
            ].join('\n'));
            return;
        }
        if (!pendingDraft?.confirmedOutline?.trim()) {
            console.log(`第 ${targetChapter} 章还没有确认方案。请先执行 /novel 确认章节 ${targetChapter}。`);
            return;
        }
        const writingBrief = [
            pendingDraft.prompt?.trim(),
            '',
            '【确认后的章节方案】',
            pendingDraft.confirmedOutline.trim(),
            parsed.userPrompt.trim() ? `\n【补充要求】\n${parsed.userPrompt.trim()}` : '',
        ].join('\n').trim();
        const context = await contextAssembler.assembleContext(project, targetChapter, writingBrief);
        const stats = contentGenerator.getTokenStats(context);
        await projectManager.upsertChapterPlanEntry(project, {
            chapterNumber: targetChapter,
            title: chapterTitle || '待定',
            status: '写作中',
            note: '已生成正文写作上下文，等待产出草稿。',
        });
        await projectManager.saveProject(project);
        console.log(renderTokenStats(stats));
        console.log(contentGenerator.buildGenerationPrompt(context));
        console.log([
            '',
            '请由助手根据以上上下文直接生成正文，并立即写入本章草稿文件。',
            `目标草稿文件：${path_1.default.join(project.rootPath, 'chapters', 'drafts', `${(0, utils_1.formatChapterNumber)(targetChapter)}-draft.md`)}`,
            '用户不需要再把正文贴回这个命令。',
        ].join('\n'));
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleFinalizeChapter(args, text) {
    const parsed = parseChapterCommandArgs(args, text);
    try {
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
        project.pendingChapterDraft = {
            number: targetChapter,
            title: parsedChapter.title,
            prompt: pendingDraft?.prompt?.trim() || '',
            confirmedOutline: pendingDraft?.confirmedOutline,
            updatedAt: Date.now(),
        };
        await projectManager.upsertChapterPlanEntry(project, {
            chapterNumber: targetChapter,
            title: parsedChapter.title || '待定',
            status: '已定稿',
            note: '正文已定稿，正在自动生成摘要并同步全局资料。',
        });
        await syncChapterSummaryAndProjectState(project, chapter, autoSummary);
        console.log(`第 ${chapter.number} 章已定稿并保存到正式章节文件。`);
        console.log(`正式文件：${chapter.contentPath}`);
        console.log(`摘要已自动生成并同步到全局摘要、人物关系、时间线、章节计划和相关角色卡。`);
        console.log('这一章已完成，可以直接开始下一章。');
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleContinue(args, text) {
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
    if (!userPrompt.trim()) {
        console.log('请提供本章写作要点。');
        return;
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        const targetChapter = chapterNumber ?? (project.currentChapter + 1);
        const persistedTitle = chapterTitle || projectManager.getChapter(project, targetChapter)?.title || '';
        project.pendingChapterDraft = buildPendingDraft(targetChapter, persistedTitle, userPrompt);
        await projectManager.upsertChapterPlanEntry(project, {
            chapterNumber: targetChapter,
            title: persistedTitle || '待定',
            status: '草稿',
            note: '已生成正文提示词，待保存正式正文。',
        });
        await projectManager.saveProject(project);
        console.log(`正在为第 ${targetChapter} 章准备上下文...`);
        const context = await contextAssembler.assembleContext(project, targetChapter, userPrompt);
        const stats = contentGenerator.getTokenStats(context);
        console.log(renderTokenStats(stats));
        console.log(contentGenerator.buildGenerationPrompt(context));
        console.log(`\n生成正文后，请运行 /novel 保存章节正文 ${targetChapter}${persistedTitle ? ` [默认标题：${persistedTitle}]` : ''} 并附上正文内容。`);
    }
    catch (error) {
        console.error('出错：', error.message);
        console.log('\n提示：请先在项目目录运行 /novel new 创建项目。');
    }
}
async function handleJump(args, text) {
    if (args.length < 1 || isNaN(parseInt(args[0], 10))) {
        console.log('用法：/novel jump <章节号> <要点>');
        return;
    }
    const chapterNumber = parseInt(args[0], 10);
    const chapterTitle = text !== undefined ? args.slice(1).join(' ').trim() : '';
    const userPrompt = text || args.slice(1).join(' ');
    if (!userPrompt.trim()) {
        console.log('请提供本章写作要点。');
        return;
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        const persistedTitle = chapterTitle || projectManager.getChapter(project, chapterNumber)?.title || '';
        project.pendingChapterDraft = buildPendingDraft(chapterNumber, persistedTitle, userPrompt);
        await projectManager.upsertChapterPlanEntry(project, {
            chapterNumber,
            title: persistedTitle || '待定',
            status: '草稿',
            note: '跳章创作中，已生成正文提示词。',
        });
        await projectManager.saveProject(project);
        console.log(`跳转到第 ${chapterNumber} 章...`);
        const context = await contextAssembler.assembleContext(project, chapterNumber, userPrompt);
        const stats = contentGenerator.getTokenStats(context);
        console.log(renderTokenStats(stats));
        console.log(contentGenerator.buildGenerationPrompt(context));
        console.log(`\n生成正文后，请运行 /novel 保存章节正文 ${chapterNumber}${persistedTitle ? ` [默认标题：${persistedTitle}]` : ''} 并附上正文内容。`);
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleSaveChapter(args, text) {
    if (!text?.trim()) {
        console.log('用法：/novel 保存章节正文 [章节号] [标题]，并附上完整正文内容。');
        return;
    }
    let chapterNumber;
    let titleArgs = args;
    if (args.length > 0 && !isNaN(parseInt(args[0], 10))) {
        chapterNumber = parseInt(args[0], 10);
        titleArgs = args.slice(1);
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        const targetChapter = chapterNumber ?? (project.currentChapter + 1);
        const existingChapter = projectManager.getChapter(project, targetChapter);
        const pendingDraft = getPendingDraft(project, targetChapter);
        const parsedChapter = extractChapterContent(text, targetChapter, titleArgs.join(' '), existingChapter?.title || pendingDraft?.title);
        const chapter = await projectManager.saveChapter(project, targetChapter, parsedChapter.title, parsedChapter.content);
        await projectManager.upsertChapterPlanEntry(project, {
            chapterNumber: targetChapter,
            title: parsedChapter.title || existingChapter?.title || pendingDraft?.title || '待定',
            status: '已成稿',
            note: '正文已保存，待更新章节摘要。',
        });
        if (pendingDraft) {
            delete project.pendingChapterDraft;
            await projectManager.saveProject(project);
        }
        console.log(`已保存第 ${chapter.number} 章${chapter.title ? `《${chapter.title}》` : ''}，当前字数 ${chapter.wordCount}。`);
        console.log(`接下来请运行 /novel 更新摘要 ${chapter.number} 生成本章摘要提示词。`);
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleUpdateSummary(args) {
    const chapterNumberFromArgs = args.length > 0 && !isNaN(parseInt(args[0], 10))
        ? parseInt(args[0], 10)
        : undefined;
    try {
        const project = await projectManager.loadProject(process.cwd());
        const chapterNumber = chapterNumberFromArgs ?? project.currentChapter;
        const chapter = projectManager.getChapter(project, chapterNumber);
        if (!chapter) {
            console.log(`找不到第 ${chapterNumber} 章。`);
            return;
        }
        const [content, globalSummary] = await Promise.all([
            projectManager.readChapterContent(chapter),
            projectManager.readGlobalSummary(project),
        ]);
        console.log(`正在生成第 ${chapterNumber} 章摘要...`);
        console.log(summaryUpdater.buildChapterSummaryPrompt(content, globalSummary));
        console.log(`\n生成章节摘要后，请运行 /novel 保存章节摘要 ${chapterNumber} 并附上摘要内容。`);
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleUpdateSummaryDone(args, text) {
    const chapterNumberFromArgs = args.length > 0 && !isNaN(parseInt(args[0], 10))
        ? parseInt(args[0], 10)
        : undefined;
    if (!text?.trim()) {
        console.log('请提供生成好的章节摘要内容。');
        return;
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        const chapterNumber = chapterNumberFromArgs ?? project.currentChapter;
        const chapter = projectManager.getChapter(project, chapterNumber);
        if (!chapter) {
            console.log(`找不到第 ${chapterNumber} 章。`);
            return;
        }
        const chapterSummary = text.trim();
        const updatedCardNames = await syncChapterSummaryAndProjectState(project, chapter, chapterSummary);
        console.log(`已保存第 ${chapterNumber} 章摘要，并自动更新全局摘要、人物关系、时间线、章节计划${updatedCardNames.length > 0 ? `、角色卡（${updatedCardNames.join('、')}）` : ''}。`);
        console.log('这一章的资料同步已经完成，可以继续准备下一章。');
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleApplyGlobalSummary(text) {
    if (!text?.trim()) {
        console.log('请提供更新后的全局摘要内容。');
        return;
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        const summary = text.trim();
        await projectManager.saveGlobalSummary(project, summary);
        await projectManager.saveProject(project);
        const estimatedTokens = Math.ceil(summary.length / 1.5);
        console.log(`已保存全局摘要，当前估算约 ${estimatedTokens} tokens。`);
        if (summaryUpdater.needsCompression(summary, project.config.maxGlobalSummaryTokens)) {
            const prompt = summaryUpdater.buildCompressPrompt(summary, project.config.maxGlobalSummaryTokens);
            console.log(`\n全局摘要已超过上限，可继续使用下面的压缩提示词：\n\n${prompt}`);
        }
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleApplyCharacterRelationships(text) {
    if (!text?.trim()) {
        console.log('请提供更新后的人物关系内容。');
        return;
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        await projectManager.saveCharacterRelationships(project, text.trim());
        await projectManager.saveProject(project);
        console.log('已保存人物关系。');
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleSaveCharacterCard(args, text) {
    const name = args.join(' ').trim();
    if (!name || !text?.trim()) {
        console.log('用法：/novel 保存角色卡 <角色名> 并附上角色卡内容。');
        return;
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        const filePath = await projectManager.saveCharacterCard(project, name, text.trim());
        await projectManager.saveProject(project);
        console.log(`已保存角色卡：${filePath}`);
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleSaveTimeline(text) {
    if (!text?.trim()) {
        console.log('请提供时间线内容。');
        return;
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        await projectManager.saveTimeline(project, text.trim());
        await projectManager.saveProject(project);
        console.log('已保存时间线。');
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleSaveChapterPlan(text) {
    if (!text?.trim()) {
        console.log('请提供章节计划内容。');
        return;
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        await projectManager.saveChapterPlan(project, text.trim() + '\n');
        await projectManager.saveProject(project);
        console.log('已保存章节计划。');
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleSnapshot(args) {
    try {
        const project = await projectManager.loadProject(process.cwd());
        const snapshotPath = await projectManager.createProjectSnapshot(project, args.join(' ').trim() || undefined);
        console.log(`已创建项目快照：${snapshotPath}`);
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleSaveStyleMaterial(args, text) {
    if (args.length < 2 || !text?.trim()) {
        console.log('用法：/novel 保存素材 <分类> <名称> 并附上原始素材。');
        return;
    }
    const [category, ...nameParts] = args;
    const name = nameParts.join(' ').trim();
    try {
        const project = await projectManager.loadProject(process.cwd());
        const filePath = await projectManager.saveStyleReferenceRaw(project, category, name, text.trim());
        console.log(`已保存原始素材：${filePath}`);
        console.log(`接下来可以运行 /novel 分析素材 ${category} ${name} 生成风格卡提示词。`);
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleAnalyzeStyleMaterial(args) {
    if (args.length < 2) {
        console.log('用法：/novel 分析素材 <分类> <名称>');
        return;
    }
    const [category, ...nameParts] = args;
    const name = nameParts.join(' ').trim();
    try {
        const project = await projectManager.loadProject(process.cwd());
        const materials = await projectManager.readStyleReferenceRawMaterials(project);
        const target = materials.find(item => item.category === category && item.name === name);
        if (!target) {
            console.log(`找不到素材：${category} / ${name}`);
            return;
        }
        const prompt = summaryUpdater.buildStyleCardPrompt(category, name, target.content);
        console.log(`\n${prompt}\n`);
        console.log(`生成完成后，请运行 /novel 保存风格卡 ${category} ${name} 并附上完整内容。`);
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleSaveStyleCard(args, text) {
    if (args.length < 2 || !text?.trim()) {
        console.log('用法：/novel 保存风格卡 <分类> <名称> 并附上风格卡内容。');
        return;
    }
    const [category, ...nameParts] = args;
    const name = nameParts.join(' ').trim();
    try {
        const project = await projectManager.loadProject(process.cwd());
        const filePath = await projectManager.saveStyleReferenceCard(project, category, name, text.trim());
        console.log(`已保存风格卡：${filePath}`);
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleStatus() {
    try {
        const project = await projectManager.loadProject(process.cwd());
        const [globalSummary, timeline, chapterPlan, characterCards] = await Promise.all([
            projectManager.readGlobalSummary(project),
            projectManager.readTimeline(project),
            projectManager.readChapterPlan(project),
            projectManager.readCharacterCards(project),
        ]);
        const totalWords = project.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
        const globalTokens = Math.ceil(globalSummary.length / 1.5);
        console.log([
            `标题：${project.title}`,
            `作者：${project.author}`,
            `总章节：${project.totalChapters}`,
            `当前章节：${project.currentChapter}`,
            `总字数：${totalWords}`,
            `全局摘要大小：${globalTokens} / ${project.config.maxGlobalSummaryTokens} tokens`,
            `角色卡数量：${characterCards.length}`,
            `时间线：${timeline.trim() ? '已建立' : '未建立'}`,
            `章节计划：${chapterPlan.trim() ? '已建立' : '未建立'}`,
            `最近完整章节保留：${project.config.maxRecentFullChapters} 章`,
            `最近摘要保留：${project.config.maxRecentChapterSummaries} 章`,
            `上下文总预算：${project.config.maxContextTokens} tokens`,
        ].join('\n'));
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleReadCharacterRelationships() {
    try {
        const project = await projectManager.loadProject(process.cwd());
        console.log(await projectManager.readCharacterRelationships(project));
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleReadCharacterCards(args) {
    try {
        const project = await projectManager.loadProject(process.cwd());
        const cards = await projectManager.readCharacterCards(project);
        const keyword = args.join(' ').trim().toLowerCase();
        const filteredCards = keyword
            ? cards.filter(card => card.name.toLowerCase().includes(keyword))
            : cards;
        if (filteredCards.length === 0) {
            console.log(keyword ? `找不到与 "${args.join(' ')}" 相关的角色卡。` : '当前还没有角色卡。');
            return;
        }
        for (const card of filteredCards) {
            console.log(`\n===== ${card.name} =====\n`);
            console.log(card.content);
        }
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleReadTimeline() {
    try {
        const project = await projectManager.loadProject(process.cwd());
        console.log(await projectManager.readTimeline(project));
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleReadChapterPlan() {
    try {
        const project = await projectManager.loadProject(process.cwd());
        console.log(await projectManager.readChapterPlan(project));
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleRead(args) {
    if (args.length < 1 || isNaN(parseInt(args[0], 10))) {
        console.log('用法：/novel 阅读 <章节号>');
        return;
    }
    const chapterNumber = parseInt(args[0], 10);
    try {
        const project = await projectManager.loadProject(process.cwd());
        const chapter = projectManager.getChapter(project, chapterNumber);
        if (!chapter) {
            console.log(`找不到第 ${chapterNumber} 章。`);
            return;
        }
        const [content, summary] = await Promise.all([
            projectManager.readChapterContent(chapter),
            projectManager.readChapterSummary(chapter),
        ]);
        console.log(content);
        if (summary.trim()) {
            console.log(`\n--- 章节摘要 ---\n${summary}\n`);
        }
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleReadStyleLibrary() {
    try {
        const project = await projectManager.loadProject(process.cwd());
        const cards = await projectManager.readStyleReferenceCards(project);
        if (cards.length === 0) {
            console.log('当前还没有风格卡。');
            return;
        }
        for (const card of cards) {
            console.log(`\n===== ${card.category} / ${card.name} =====\n`);
            console.log(card.content);
        }
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleCompress() {
    try {
        const project = await projectManager.loadProject(process.cwd());
        const summary = await projectManager.readGlobalSummary(project);
        const currentTokens = Math.ceil(summary.length / 1.5);
        const targetTokens = project.config.maxGlobalSummaryTokens;
        console.log(`当前全局摘要：${currentTokens} tokens，压缩目标：${targetTokens} tokens`);
        console.log(summaryUpdater.buildCompressPrompt(summary, targetTokens));
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleRebuildProjectState() {
    try {
        const project = await projectManager.loadProject(process.cwd());
        const summaries = [];
        for (const chapter of projectManager.getSortedChapters(project)) {
            const summary = await projectManager.readChapterSummary(chapter);
            if (summary.trim()) {
                summaries.push(`## 第${chapter.number}章 ${chapter.title}\n\n${summary.trim()}`);
            }
        }
        if (summaries.length === 0) {
            console.log('当前没有章节摘要，无法重建全局资料。');
            return;
        }
        const [globalSummary, characterRelationships] = await Promise.all([
            projectManager.readGlobalSummary(project),
            projectManager.readCharacterRelationships(project),
        ]);
        const prompt = summaryUpdater.buildRebuildProjectStatePrompt(summaries.join('\n\n'), globalSummary, characterRelationships, project.config.maxGlobalSummaryTokens);
        console.log(`\n${prompt}\n`);
        console.log('生成完成后，请分别保存到 /novel 保存全局摘要 和 /novel 保存人物关系。');
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleConsistencyCheck(args) {
    const chapterNumberFromArgs = args.length > 0 && !isNaN(parseInt(args[0], 10))
        ? parseInt(args[0], 10)
        : undefined;
    try {
        const project = await projectManager.loadProject(process.cwd());
        const targetChapter = chapterNumberFromArgs ?? project.currentChapter;
        const chapter = projectManager.getChapter(project, targetChapter);
        if (!chapter) {
            console.log(`找不到第 ${targetChapter} 章。`);
            return;
        }
        const chapterContent = await projectManager.readChapterContent(chapter);
        const context = await contextAssembler.assembleContext(project, targetChapter, `一致性检查：第${targetChapter}章 ${chapter.title}`.trim(), {
            maxRecentFullChapters: Math.max(project.config.maxRecentFullChapters, 2),
            maxRecentChapterSummaries: Math.max(project.config.maxRecentChapterSummaries, 5),
        });
        const formattedContext = contextAssembler.formatContextForPrompt(context);
        console.log(`\n${summaryUpdater.buildConsistencyCheckPrompt(formattedContext, chapterContent)}\n`);
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleReviewArc(args) {
    let startChapter;
    let endChapter;
    if (args.length > 0 && !isNaN(parseInt(args[0], 10))) {
        startChapter = parseInt(args[0], 10);
    }
    if (args.length > 1 && !isNaN(parseInt(args[1], 10))) {
        endChapter = parseInt(args[1], 10);
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        const sortedChapters = projectManager.getSortedChapters(project);
        if (sortedChapters.length === 0) {
            console.log('当前还没有章节，无法复盘。');
            return;
        }
        const resolvedStart = startChapter ?? Math.max(project.currentChapter - 4, 1);
        const resolvedEnd = endChapter ?? project.currentChapter;
        const targetChapters = sortedChapters.filter(chapter => chapter.number >= resolvedStart && chapter.number <= resolvedEnd);
        if (targetChapters.length === 0) {
            console.log(`找不到第 ${resolvedStart} 到 ${resolvedEnd} 章的内容。`);
            return;
        }
        const chapterSummaries = [];
        for (const chapter of targetChapters) {
            const summary = await projectManager.readChapterSummary(chapter);
            if (summary.trim()) {
                chapterSummaries.push(`## 第${chapter.number}章 ${chapter.title || ''}\n\n${summary.trim()}`);
            }
        }
        if (chapterSummaries.length === 0) {
            console.log('目标章节范围内还没有可用摘要，请先更新摘要后再复盘。');
            return;
        }
        const [globalSummary, timeline, chapterPlan] = await Promise.all([
            projectManager.readGlobalSummary(project),
            projectManager.readTimeline(project),
            projectManager.readChapterPlan(project),
        ]);
        const rangeLabel = `第${resolvedStart}章到第${resolvedEnd}章`;
        console.log(`\n${summaryUpdater.buildArcReviewPrompt(rangeLabel, globalSummary, timeline, chapterPlan, chapterSummaries.join('\n\n'))}\n`);
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handlePlanNextChapter(args, text) {
    const chapterNumber = args.length > 0 && !isNaN(parseInt(args[0], 10))
        ? parseInt(args[0], 10)
        : undefined;
    try {
        const project = await projectManager.loadProject(process.cwd());
        const targetChapter = chapterNumber ?? (project.currentChapter + 1);
        const recentChapters = projectManager.getLastNChapters(project, 5, targetChapter);
        const chapterSummaries = [];
        for (const chapter of recentChapters) {
            const summary = await projectManager.readChapterSummary(chapter);
            if (summary.trim()) {
                chapterSummaries.push(`## 第${chapter.number}章 ${chapter.title || ''}\n\n${summary.trim()}`);
            }
        }
        const [globalSummary, timeline, chapterPlan] = await Promise.all([
            projectManager.readGlobalSummary(project),
            projectManager.readTimeline(project),
            projectManager.readChapterPlan(project),
        ]);
        console.log(`\n${summaryUpdater.buildNextChapterPlanningPrompt(targetChapter, globalSummary, timeline, chapterPlan, chapterSummaries.join('\n\n'), text?.trim() || '')}\n`);
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function handleContextPreview(args, text) {
    let chapterNumber;
    let inlinePrompt = text ?? '';
    if (args.length > 0 && !isNaN(parseInt(args[0], 10))) {
        chapterNumber = parseInt(args[0], 10);
        if (!text) {
            inlinePrompt = args.slice(1).join(' ');
        }
    }
    else if (!text) {
        inlinePrompt = args.join(' ');
    }
    try {
        const project = await projectManager.loadProject(process.cwd());
        const targetChapter = chapterNumber ?? (project.currentChapter + 1);
        const pendingDraft = getPendingDraft(project, targetChapter);
        const userPrompt = inlinePrompt.trim() || pendingDraft?.prompt || '上下文预览';
        const context = await contextAssembler.assembleContext(project, targetChapter, userPrompt);
        const stats = contentGenerator.getTokenStats(context);
        const formatted = contextAssembler.formatContextForPrompt(context);
        console.log([
            '=== 上下文诊断 ===',
            '',
            `目标章节：第 ${targetChapter} 章`,
            `角色卡：${context.characterCards.map(card => card.name).join('、') || '无'}`,
            `风格卡：${context.styleReferences.map(card => `${card.category}/${card.name}`).join('、') || '无'}`,
            `最近完整章节：${context.recentFullContents.map(item => item.number).join('、') || '无'}`,
            `最近章节摘要：${context.recentChapterSummaries.map(item => item.number).join('、') || '无'}`,
            '',
            renderTokenStats(stats).trim(),
            '',
            '=== 组装后的上下文 ===',
            '',
            formatted,
        ].join('\n'));
    }
    catch (error) {
        console.error('出错：', error.message);
    }
}
async function autoUpdateCharacterCards(project, existingCards, chapterNumber, chapterTitle, chapterSummary, extractedNames) {
    const existingMap = new Map(existingCards.map(card => [card.name, card.content]));
    const targetNames = Array.from(new Set([
        ...pickRelevantCharacterCards(existingCards.map(card => ({ name: card.name, content: card.content })), chapterSummary).map(card => card.name),
        ...extractedNames,
    ])).slice(0, 5);
    const saved = [];
    for (const name of targetNames) {
        const previous = existingMap.get(name)?.trim();
        const nextContent = previous
            ? appendChapterNote(previous, chapterNumber, chapterTitle, chapterSummary)
            : [
                `# ${name}`,
                '',
                '## 基础信息',
                '- 身份：待补充',
                '- 立场：待补充',
                '',
                '## 最近章节记录',
                `- 第${chapterNumber}章 ${chapterTitle || ''}：${summarizeForLine(chapterSummary, 80)}`,
            ].join('\n');
        await projectManager.saveCharacterCard(project, name, nextContent);
        saved.push(name);
    }
    return saved;
}
async function syncChapterSummaryAndProjectState(project, chapter, chapterSummary) {
    await projectManager.saveChapterSummary(chapter, chapterSummary);
    const [globalSummary, characterRelationships, timeline, chapterPlan, characterCards] = await Promise.all([
        projectManager.readGlobalSummary(project),
        projectManager.readCharacterRelationships(project),
        projectManager.readTimeline(project),
        projectManager.readChapterPlan(project),
        projectManager.readCharacterCards(project),
    ]);
    const extractedNames = extractCharacterNames(chapterSummary, characterCards.map(card => card.name));
    const updatedGlobalSummary = autoUpdateGlobalSummary(globalSummary, chapter.number, chapter.title, chapterSummary);
    const updatedRelationships = autoUpdateCharacterRelationships(characterRelationships, chapter.number, chapter.title, chapterSummary, extractedNames);
    const updatedTimeline = autoUpdateTimeline(timeline, chapter.number, chapter.title, chapterSummary, extractedNames);
    const updatedChapterPlan = autoUpdateChapterPlanMarkdown(chapterPlan, chapter.number, chapter.title, chapterSummary);
    await Promise.all([
        projectManager.saveGlobalSummary(project, updatedGlobalSummary),
        projectManager.saveCharacterRelationships(project, updatedRelationships),
        projectManager.saveTimeline(project, updatedTimeline),
        projectManager.saveChapterPlan(project, updatedChapterPlan),
    ]);
    const updatedCardNames = await autoUpdateCharacterCards(project, characterCards, chapter.number, chapter.title, chapterSummary, extractedNames);
    await projectManager.upsertChapterPlanEntry(project, {
        chapterNumber: chapter.number,
        title: chapter.title || '待定',
        status: '已完成',
        note: `摘要与全局资料已自动同步${updatedCardNames.length > 0 ? `，角色卡：${updatedCardNames.join('、')}` : ''}。`,
    });
    await projectManager.saveProject(project);
    return updatedCardNames;
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
function generateChapterSummaryFromContent(chapterContent, chapterNumber, chapterTitle) {
    const cleaned = chapterContent
        .replace(/^#.*$/gm, '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    const firstParagraph = cleaned[0] || '';
    const middleParagraph = cleaned[Math.floor(cleaned.length / 2)] || '';
    const lastParagraph = cleaned[cleaned.length - 1] || '';
    const uniqueParts = Array.from(new Set([firstParagraph, middleParagraph, lastParagraph].filter(Boolean)));
    const summaryLines = uniqueParts
        .slice(0, 3)
        .map(part => `- ${summarizeForLine(part, 90)}`);
    return [
        `# 第${chapterNumber}章${chapterTitle ? ` ${chapterTitle}` : ''}摘要`,
        '',
        '## 本章事件',
        summaryLines.length > 0 ? summaryLines.join('\n') : '- （待补充）',
        '',
        '## 简述',
        summarizeForLine(cleaned.join(' '), 180) || '（待补充）',
    ].join('\n');
}
function autoUpdateGlobalSummary(currentGlobalSummary, chapterNumber, chapterTitle, chapterSummary) {
    const parsed = (0, utils_1.parseGlobalSummary)(currentGlobalSummary || '');
    const chapterLabel = `第${chapterNumber}章${chapterTitle ? `《${chapterTitle}》` : ''}`;
    const summaryLine = `${chapterLabel}：${summarizeForLine(chapterSummary, 120)}`;
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
    let output = ensureSectionContent(currentRelationships, '主要人物', mergeBulletNames(getSectionContent(currentRelationships, '主要人物'), extractedNames));
    output = ensureSectionContent(output, '当前状态', appendBulletLine(getSectionContent(output, '当前状态'), `第${chapterNumber}章${chapterTitle ? `《${chapterTitle}》` : ''}：${summarizeForLine(chapterSummary, 120)}`));
    if (extractedNames.length >= 2) {
        output = ensureSectionContent(output, '人物关系', appendBulletLine(getSectionContent(output, '人物关系'), `第${chapterNumber}章涉及：${extractedNames.join('、')}。具体关系变化待后续细化。`));
    }
    return output.trim() + '\n';
}
function autoUpdateTimeline(currentTimeline, chapterNumber, chapterTitle, chapterSummary, extractedNames) {
    const lines = currentTimeline.trimEnd().split(/\r?\n/);
    const entryLine = `| ${findNextTimelineIndex(lines)} | 第${chapterNumber}章 | 第${chapterNumber}章${chapterTitle ? ` ${chapterTitle}` : ''} | 待补 | ${escapeTableCell(summarizeForLine(chapterSummary, 60))} | ${escapeTableCell(extractedNames.join('、') || '待补')} |`;
    if (!lines.some(line => line.includes(`| 第${chapterNumber}章`) || line.includes(`第${chapterNumber}章${chapterTitle ? ` ${chapterTitle}` : ''}`))) {
        lines.push(entryLine);
    }
    return lines.join('\n').trim() + '\n';
}
function autoUpdateChapterPlanMarkdown(currentChapterPlan, chapterNumber, chapterTitle, chapterSummary) {
    const lines = currentChapterPlan.split(/\r?\n/);
    const targetPrefix = `| ${chapterNumber} |`;
    const note = summarizeForLine(chapterSummary, 50);
    const newRow = `| ${chapterNumber} | ${chapterTitle || '待定'} | 已完成 | ${note} | 已在正文中展开 | 摘要及全局资料已自动同步 |`;
    const existingIndex = lines.findIndex(line => line.trim().startsWith(targetPrefix));
    if (existingIndex >= 0) {
        lines[existingIndex] = newRow;
    }
    else {
        const insertIndex = Math.max(lines.findIndex(line => line.startsWith('状态建议')), lines.length);
        lines.splice(insertIndex, 0, newRow);
    }
    return lines.join('\n').trim() + '\n';
}
function extractCharacterNames(summary, existingNames) {
    const names = new Set();
    for (const name of existingNames) {
        if (name && summary.includes(name)) {
            names.add(name);
        }
    }
    const matches = summary.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    for (const candidate of matches) {
        if (candidate.length >= 2 &&
            candidate.length <= 4 &&
            !candidate.includes('章节') &&
            !candidate.includes('摘要') &&
            !candidate.includes('主角') &&
            !candidate.includes('本章')) {
            if (existingNames.includes(candidate)) {
                names.add(candidate);
            }
        }
    }
    return Array.from(names);
}
function extractDocumentTitle(content, fallback) {
    const match = content.match(/^#\s+(.+)$/m);
    return match?.[1]?.trim() || fallback;
}
function withTitle(original, body, title) {
    const normalizedBody = body.trim();
    return `# ${title}\n\n${normalizedBody}\n`;
}
function normalizeListLikeBlock(content) {
    return content
        .split(/\r?\n/)
        .map(line => line.replace(/^[*-]\s*/, '').trim())
        .filter(line => line && line !== '(暂无)' && line !== '(尚未开始)');
}
function normalizeStringArray(values) {
    return (values || []).map(item => item.trim()).filter(Boolean);
}
function summarizeForLine(text, maxLength) {
    const singleLine = text.replace(/\s+/g, ' ').trim();
    if (singleLine.length <= maxLength) {
        return singleLine;
    }
    return singleLine.slice(0, Math.max(0, maxLength - 1)).trim() + '…';
}
function appendChapterNote(content, chapterNumber, chapterTitle, chapterSummary) {
    const note = `- 第${chapterNumber}章${chapterTitle ? ` ${chapterTitle}` : ''}：${summarizeForLine(chapterSummary, 80)}`;
    const sectionContent = getSectionContent(content, '最近章节记录');
    return ensureSectionContent(content, '最近章节记录', appendBulletLine(sectionContent, note));
}
function mergeBulletNames(content, names) {
    const existing = new Set(content
        .split(/\r?\n/)
        .map(line => line.replace(/^[*-]\s*/, '').trim())
        .filter(Boolean));
    for (const name of names) {
        existing.add(name);
    }
    const lines = Array.from(existing).filter(Boolean).map(item => `- ${item}`);
    return lines.length > 0 ? lines.join('\n') : '(暂无)';
}
function appendBulletLine(content, line) {
    const normalized = content.trim();
    const lines = normalized && normalized !== '(暂无)'
        ? normalized.split(/\r?\n/).filter(Boolean)
        : [];
    if (!lines.some(item => item.includes(line))) {
        lines.push(line.startsWith('- ') ? line : `- ${line}`);
    }
    return lines.join('\n') || '(暂无)';
}
function getSectionContent(document, heading) {
    const regex = new RegExp(`##\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`);
    const match = document.match(regex);
    return match?.[1]?.trim() || '(暂无)';
}
function ensureSectionContent(document, heading, content) {
    const normalizedContent = content.trim() || '(暂无)';
    const regex = new RegExp(`##\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`);
    if (regex.test(document)) {
        return document.replace(regex, `## ${heading}\n${normalizedContent}\n`);
    }
    const trimmed = document.trimEnd();
    return `${trimmed}\n\n## ${heading}\n${normalizedContent}\n`;
}
function findNextTimelineIndex(lines) {
    const values = lines
        .map(line => {
        const match = line.match(/^\|\s*(\d+)\s*\|/);
        return match ? Number(match[1]) : 0;
    })
        .filter(value => Number.isFinite(value) && value > 0);
    return (values.length > 0 ? Math.max(...values) : 0) + 1;
}
function escapeTableCell(value) {
    return value.replace(/\|/g, '｜');
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function showHelp() {
    console.log([
        'AI 小说写作助手 /novel',
        '',
        '推荐工作流：',
        '/novel 规划章节 [章节号] [标题] <本章需求>',
        '/novel 确认章节 [章节号] [标题] <确认后的章节方案>',
        '/novel 写正文 [章节号] [标题]',
        '正文由助手直接生成并写入 chapters/drafts/ 草稿文件',
        '/novel 保存定稿 [章节号] [标题]',
        '/novel 保存章节摘要 [章节号] <摘要>  # 仅在你想手工覆盖自动摘要时使用',
        '',
        '兼容旧命令：',
        '/novel 新建',
        '/novel 续写 [章节号] [标题] <要点>',
        '/novel 跳转 <章节号> <要点>',
        '/novel 保存章节正文 [章节号] [标题] <正文>',
        '/novel 保存全局摘要 <内容>',
        '/novel 保存人物关系 <内容>',
        '/novel 保存角色卡 <角色名> <内容>',
        '/novel 保存时间线 <内容>',
        '/novel 保存章节计划 <内容>',
        '/novel 自检 [章节号]',
        '/novel 复盘 [起始章节] [结束章节]',
        '/novel 规划下一章 [章节号]',
        '/novel 上下文 [章节号] [要点]',
        '/novel 快照 [名称]',
    ].join('\n'));
}
module.exports = {
    name: 'novel',
    description: 'AI 辅助长篇小说写作，自动维护摘要、章节计划、时间线和角色卡。',
    handler,
    commands: [
        { name: '新建', description: '创建小说项目' },
        { name: '规划章节', description: '记录本章需求并进入确认阶段' },
        { name: '确认章节', description: '确认章节方案，进入正文写作阶段' },
        { name: '写正文', description: '生成正文写作上下文，供助手直接落草稿文件' },
        { name: '保存定稿', description: '从草稿或附带正文收口定稿，并自动同步资料' },
        { name: '续写', description: '续写下一章或指定章节' },
        { name: '跳转', description: '跳到指定章节创作' },
        { name: '保存章节正文', description: '保存章节正文' },
        { name: '更新摘要', description: '生成章节摘要提示词（兼容旧流程）' },
        { name: '保存章节摘要', description: '保存章节摘要并继续更新全局资料' },
        { name: '保存全局摘要', description: '保存更新后的全局摘要' },
        { name: '保存人物关系', description: '保存更新后的人物关系' },
        { name: '保存角色卡', description: '保存角色卡' },
        { name: '保存时间线', description: '保存时间线' },
        { name: '保存章节计划', description: '保存章节计划' },
        { name: '快照', description: '创建项目快照' },
        { name: '保存素材', description: '保存原始风格素材' },
        { name: '分析素材', description: '生成风格卡提示词' },
        { name: '保存风格卡', description: '保存风格卡' },
        { name: '状态', description: '查看项目状态' },
        { name: '人物关系', description: '查看人物关系' },
        { name: '角色卡', description: '查看角色卡' },
        { name: '时间线', description: '查看时间线' },
        { name: '章节计划', description: '查看章节计划' },
        { name: '阅读', description: '阅读章节内容' },
        { name: '风格库', description: '查看风格卡' },
        { name: '压缩', description: '生成全局摘要压缩提示词' },
        { name: '重建资料', description: '根据章节摘要重建项目资料' },
        { name: '自检', description: '生成一致性检查提示词' },
        { name: '复盘', description: '生成阶段复盘提示词' },
        { name: '规划下一章', description: '生成下一章规划提示词' },
        { name: '上下文', description: '查看本次写作的上下文组装结果' },
        { name: '帮助', description: '显示帮助' },
        { name: 'new', description: 'Create project' },
        { name: 'plan-chapter', description: 'Record chapter brief' },
        { name: 'confirm-chapter', description: 'Confirm chapter outline' },
        { name: 'write-draft', description: 'Build writing context for assistant draft generation' },
        { name: 'finalize-chapter', description: 'Finalize chapter draft' },
        { name: 'continue', description: 'Continue chapter' },
        { name: 'jump', description: 'Jump to chapter' },
        { name: 'save-chapter', description: 'Save chapter' },
        { name: 'update-summary', description: 'Build chapter summary prompt' },
        { name: 'update-summary-done', description: 'Save chapter summary' },
        { name: 'apply-global-summary', description: 'Save global summary' },
        { name: 'save-character-card', description: 'Save character card' },
        { name: 'save-timeline', description: 'Save timeline' },
        { name: 'save-chapter-plan', description: 'Save chapter plan' },
        { name: 'snapshot', description: 'Create snapshot' },
        { name: 'status', description: 'Show status' },
        { name: 'character-cards', description: 'Read character cards' },
        { name: 'timeline', description: 'Read timeline' },
        { name: 'plan', description: 'Read chapter plan' },
        { name: 'read', description: 'Read chapter' },
        { name: 'consistency-check', description: 'Consistency check' },
        { name: 'review-arc', description: 'Review arc' },
        { name: 'plan-next', description: 'Plan next chapter' },
        { name: 'context-preview', description: 'Preview assembled context' },
        { name: 'compress', description: 'Compress global summary' },
        { name: 'help', description: 'Show help' },
    ],
};
function extractChapterContent(rawContent, chapterNumber, explicitTitle, existingTitle) {
    const trimmedContent = rawContent.trim();
    const lines = trimmedContent.split(/\r?\n/);
    const headingLine = lines[0]?.match(/^#+\s*(.+)$/)?.[1]?.trim();
    let title = explicitTitle.trim() || existingTitle?.trim() || '';
    let content = trimmedContent;
    if (headingLine) {
        const parsedTitle = headingLine.match(new RegExp(`^第\\s*${chapterNumber}\\s*章\\s*(.*)$`));
        title = title || parsedTitle?.[1]?.trim() || headingLine;
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
    return {
        chapterNumber,
        chapterTitle,
        userPrompt,
    };
}
function buildPendingDraft(number, title, prompt) {
    return {
        number,
        title: title.trim(),
        prompt: prompt.trim(),
        updatedAt: Date.now(),
    };
}
function getPendingDraft(project, chapterNumber) {
    return project.pendingChapterDraft?.number === chapterNumber
        ? project.pendingChapterDraft
        : undefined;
}
function pickRelevantCharacterCards(cards, sourceText) {
    const normalizedSource = sourceText.toLowerCase();
    return cards
        .map(card => ({
        ...card,
        score: normalizedSource.includes(card.name.toLowerCase()) ? 1 : 0,
    }))
        .filter(card => card.score > 0)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
        .map(({ name, content }) => ({ name, content }));
}
function renderTokenStats(stats) {
    return [
        '上下文准备完成，Token 估算：',
        `  全局摘要：${stats.globalSummary} tokens`,
        `  时间线：${stats.timeline} tokens`,
        `  章节计划：${stats.chapterPlan} tokens`,
        `  角色卡：${stats.characterCards} tokens`,
        `  最近章节摘要：${stats.recentSummaries} tokens`,
        `  最近完整内容：${stats.recentFull} tokens`,
        `  风格参考卡：${stats.styleReferences} tokens`,
        `  用户要点：${stats.userPrompt} tokens`,
        `  总计：${stats.total} tokens`,
    ].join('\n');
}
function resolveNewProjectPath(workspacePath, title, rawText) {
    const directoryMatch = rawText.match(/#.*(?:目录|dir|directory)[:：]\s*(.+)/i);
    const requestedDirectory = directoryMatch?.[1]?.trim();
    const baseName = requestedDirectory || title;
    const safeDirectoryName = sanitizeDirectoryName(baseName);
    const novelsRoot = path_1.default.join(workspacePath, '小说管理');
    return path_1.default.join(novelsRoot, safeDirectoryName);
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
