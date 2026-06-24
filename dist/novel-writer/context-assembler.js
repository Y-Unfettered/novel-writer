"use strict";
/**
 * Context Assembler - assembles context from different layers with token budgeting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextAssembler = void 0;
const types_1 = require("./types");
const utils_1 = require("./utils");
class ContextAssembler {
    constructor(projectManager) {
        this.projectManager = projectManager;
    }
    async assembleContext(project, targetChapter, userPrompt, options) {
        const config = {
            maxContextTokens: options?.maxContextTokens ?? project.config.maxContextTokens ?? types_1.DEFAULT_TOKEN_BUDGET.total,
            maxCharacterCards: options?.maxCharacterCards ?? project.config.maxCharacterCards ?? 6,
            maxRecentFullChapters: options?.maxRecentFullChapters ?? project.config.maxRecentFullChapters ?? 3,
            maxRecentChapterSummaries: options?.maxRecentChapterSummaries ?? project.config.maxRecentChapterSummaries ?? 5,
            maxStyleReferences: options?.maxStyleReferences ?? project.config.maxStyleReferences ?? 4,
            maxCreatureCards: options?.maxCreatureCards ?? project.config.maxCreatureCards ?? 4,
        };
        const [globalSummary, timeline, chapterPlan] = await Promise.all([
            this.projectManager.readGlobalSummary(project),
            this.projectManager.readTimeline(project),
            this.projectManager.readChapterPlan(project),
        ]);
        const recentFullChapters = this.projectManager.getLastNChapters(project, config.maxRecentFullChapters, targetChapter);
        const recentSummaryChapters = this.projectManager.getLastNChapters(project, config.maxRecentChapterSummaries, targetChapter);
        const recentFullIds = new Set(recentFullChapters.map(chapter => chapter.number));
        const recentChapterSummaries = (await Promise.all(recentSummaryChapters
            .filter(chapter => !recentFullIds.has(chapter.number))
            .map(async (chapter) => ({
            number: chapter.number,
            summary: (await this.projectManager.readChapterSummary(chapter)).trim(),
        })))).filter(item => item.summary);
        const recentFullContents = await Promise.all(recentFullChapters.map(async (chapter) => ({
            number: chapter.number,
            content: this.stripChapterTitle(await this.projectManager.readChapterContent(chapter)),
        })));
        const [styleReferences, characterCards, creatureCards] = await Promise.all([
            this.selectStyleReferences(project, config.maxStyleReferences),
            this.selectCharacterCards(project, userPrompt, config.maxCharacterCards),
            this.selectCreatureCards(project, targetChapter, userPrompt, config.maxCreatureCards),
        ]);
        const context = {
            globalSummary,
            timeline,
            chapterPlan,
            characterCards,
            creatureCards,
            recentChapterSummaries,
            recentFullContents,
            styleReferences,
            userPrompt,
            estimatedTokens: 0,
        };
        const trimmed = await this.trimContextIfNeeded(this.recalculateEstimatedTokens(context), config.maxContextTokens);
        return {
            ...trimmed,
            estimatedTokens: Math.min(trimmed.estimatedTokens, Math.max(config.maxContextTokens, 0) * 1.5 || trimmed.estimatedTokens),
        };
    }
    async trimContextIfNeeded(context, maxTokens) {
        let trimmed = this.recalculateEstimatedTokens({
            ...context,
            characterCards: [...context.characterCards],
            creatureCards: [...context.creatureCards],
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
        while (trimmed.recentChapterSummaries.length > 1 && trimmed.estimatedTokens > maxTokens) {
            trimmed.recentChapterSummaries.shift();
            trimmed = this.recalculateEstimatedTokens(trimmed);
        }
        while (trimmed.characterCards.length > 0 && trimmed.estimatedTokens > maxTokens) {
            trimmed.characterCards.pop();
            trimmed = this.recalculateEstimatedTokens(trimmed);
        }
        while (trimmed.creatureCards.length > 0 && trimmed.estimatedTokens > maxTokens) {
            trimmed.creatureCards.pop();
            trimmed = this.recalculateEstimatedTokens(trimmed);
        }
        while (trimmed.styleReferences.length > 0 && trimmed.estimatedTokens > maxTokens) {
            trimmed.styleReferences.pop();
            trimmed = this.recalculateEstimatedTokens(trimmed);
        }
        if (trimmed.estimatedTokens > maxTokens) {
            trimmed = this.recalculateEstimatedTokens({
                ...trimmed,
                globalSummary: this.trimExcerpt(trimmed.globalSummary, Math.max(120, Math.floor(maxTokens * 0.9))),
                timeline: this.trimExcerpt(trimmed.timeline, Math.max(100, Math.floor(maxTokens * 0.6))),
                chapterPlan: this.trimExcerpt(trimmed.chapterPlan, Math.max(100, Math.floor(maxTokens * 0.6))),
                userPrompt: this.trimExcerpt(trimmed.userPrompt, Math.max(60, Math.floor(maxTokens * 0.3))),
            });
        }
        if (trimmed.estimatedTokens > maxTokens) {
            trimmed.recentFullContents = trimmed.recentFullContents.map(item => ({
                ...item,
                content: this.trimExcerpt(item.content, Math.max(120, Math.floor(maxTokens * 1.2))),
            }));
            trimmed.recentChapterSummaries = trimmed.recentChapterSummaries.map(item => ({
                ...item,
                summary: this.trimExcerpt(item.summary, Math.max(80, Math.floor(maxTokens * 0.6))),
            }));
            trimmed = this.recalculateEstimatedTokens(trimmed);
        }
        if (trimmed.estimatedTokens > maxTokens) {
            const hardCap = Math.max(80, maxTokens);
            trimmed = this.recalculateEstimatedTokens({
                ...trimmed,
                globalSummary: this.trimExcerpt(trimmed.globalSummary, Math.floor(hardCap * 0.2)),
                timeline: this.trimExcerpt(trimmed.timeline, Math.floor(hardCap * 0.12)),
                chapterPlan: this.trimExcerpt(trimmed.chapterPlan, Math.floor(hardCap * 0.12)),
                userPrompt: this.trimExcerpt(trimmed.userPrompt, Math.floor(hardCap * 0.08)),
                recentChapterSummaries: trimmed.recentChapterSummaries.map(item => ({
                    ...item,
                    summary: this.trimExcerpt(item.summary, Math.floor(hardCap * 0.1)),
                })),
                recentFullContents: trimmed.recentFullContents.map(item => ({
                    ...item,
                    content: this.trimExcerpt(item.content, Math.floor(hardCap * 0.15)),
                })),
            });
        }
        return trimmed;
    }
    recalculateEstimatedTokens(context) {
        const estimatedTokens = (0, utils_1.estimateTokens)(context.globalSummary) +
            (0, utils_1.estimateTokens)(context.timeline) +
            (0, utils_1.estimateTokens)(context.chapterPlan) +
            context.characterCards.reduce((sum, card) => sum + (0, utils_1.estimateTokens)(card.content), 0) +
            context.creatureCards.reduce((sum, card) => sum + (0, utils_1.estimateTokens)(card.content), 0) +
            context.recentChapterSummaries.reduce((sum, item) => sum + (0, utils_1.estimateTokens)(item.summary), 0) +
            context.recentFullContents.reduce((sum, item) => sum + (0, utils_1.estimateTokens)(item.content), 0) +
            context.styleReferences.reduce((sum, item) => sum + (0, utils_1.estimateTokens)(item.content), 0) +
            (0, utils_1.estimateTokens)(context.userPrompt);
        return { ...context, estimatedTokens };
    }
    formatContextForPrompt(context) {
        const sections = [
            '## 全局摘要',
            context.globalSummary || '(暂无)',
            '',
            '## 时间线',
            context.timeline || '(暂无)',
            '',
            '## 章节计划',
            context.chapterPlan || '(暂无)',
            '',
            '## 角色卡',
            context.characterCards.map(card => `### ${card.name}\n${card.content}`).join('\n\n') || '(暂无)',
            '',
            '## 生物卡',
            context.creatureCards
                .map(card => `### ${card.name} [${card.category}] 危险等级：${card.currentDangerLevel} / ${card.currentThreatLevel}\n${card.content}`)
                .join('\n\n') || '(暂无)',
            '',
            '## 最近章节摘要',
            context.recentChapterSummaries.map(item => `### 第${item.number}章\n${item.summary}`).join('\n\n') || '(暂无)',
            '',
            '## 最近完整章节',
            context.recentFullContents.map(item => `### 第${item.number}章\n${item.content}`).join('\n\n') || '(暂无)',
            '',
            '## 风格参考',
            context.styleReferences.map(item => `### ${item.category} / ${item.name}\n${item.content}`).join('\n\n') || '(暂无)',
            '',
            '## 用户要求',
            context.userPrompt || '(暂无)',
        ];
        return sections.join('\n');
    }
    stripChapterTitle(content) {
        return content.replace(/^#.*$/m, '').trim();
    }
    trimExcerpt(content, maxTokens) {
        if ((0, utils_1.estimateTokens)(content) <= maxTokens) {
            return content;
        }
        const maxChars = Math.max(1, Math.floor((maxTokens - ContextAssembler.EXCERPT_SAFETY_BUFFER_TOKENS) * 1.5));
        return `${content.slice(0, maxChars).trim()}……`;
    }
    async selectStyleReferences(project, maxCards) {
        if (maxCards <= 0) {
            return [];
        }
        const cards = await this.projectManager.readStyleReferenceCards(project);
        return cards.slice(0, maxCards).map(card => ({
            category: card.category,
            name: card.name,
            content: card.content,
        }));
    }
    async selectCharacterCards(project, userPrompt, maxCards) {
        if (maxCards <= 0) {
            return [];
        }
        const cards = await this.projectManager.readCharacterCards(project);
        const normalizedPrompt = userPrompt.toLowerCase();
        return cards
            .map(card => ({
            ...card,
            score: normalizedPrompt.includes(card.name.toLowerCase()) ? 1 : 0,
        }))
            .filter(card => card.score > 0)
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
            .slice(0, maxCards)
            .map(card => ({ name: card.name, content: card.content }));
    }
    getCurrentDangerLevel(card, targetChapter) {
        let currentEntry;
        for (const entry of card.dangerLevelHistory) {
            if (entry.chapterNumber <= targetChapter) {
                currentEntry = entry;
            }
            else {
                break;
            }
        }
        if (currentEntry) {
            return {
                dangerLevel: currentEntry.dangerLevel,
                threatLevel: currentEntry.threatLevel,
            };
        }
        return {
            dangerLevel: card.baseDangerLevel,
            threatLevel: '未知',
        };
    }
    async selectCreatureCards(project, targetChapter, userPrompt, maxCards) {
        if (maxCards <= 0) {
            return [];
        }
        const allCards = await this.projectManager.readAllCreatureCards(project);
        if (allCards.length === 0) {
            return [];
        }
        const extractedNames = (0, utils_1.extractLikelyCreatureNames)(userPrompt, allCards.map(card => card.name));
        const directMatchedNames = allCards
            .map(card => card.name)
            .filter(name => name && userPrompt.includes(name));
        const allMatchedNames = Array.from(new Set([...extractedNames, ...directMatchedNames]));
        if (allMatchedNames.length === 0) {
            return [];
        }
        const normalizedNames = allMatchedNames.map(name => name.toLowerCase());
        const matchedCards = [];
        for (const cardInfo of allCards) {
            const normalizedCardName = cardInfo.name.toLowerCase();
            const score = normalizedNames.some(name => normalizedCardName.includes(name) || name.includes(normalizedCardName))
                ? 1
                : 0;
            if (score <= 0) {
                continue;
            }
            const fullCard = await this.projectManager.readCreatureCard(project, cardInfo.category, cardInfo.name);
            const dangerInfo = fullCard
                ? this.getCurrentDangerLevel(fullCard, targetChapter)
                : { dangerLevel: '未知', threatLevel: '未知' };
            matchedCards.push({
                category: cardInfo.category,
                name: cardInfo.name,
                content: cardInfo.content,
                score,
                dangerLevel: dangerInfo.dangerLevel,
                threatLevel: dangerInfo.threatLevel,
            });
        }
        return matchedCards
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
            .slice(0, maxCards)
            .map(card => ({
            name: card.name,
            content: card.content,
            category: card.category,
            currentDangerLevel: card.dangerLevel,
            currentThreatLevel: card.threatLevel,
        }));
    }
}
exports.ContextAssembler = ContextAssembler;
ContextAssembler.EXCERPT_SAFETY_BUFFER_TOKENS = 16;
