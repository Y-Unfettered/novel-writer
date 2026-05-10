"use strict";
/**
 * Summary Updater - generates and updates chapter and global summaries
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummaryUpdater = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
class SummaryUpdater {
    constructor(skillRoot) {
        this.skillRoot = skillRoot;
        this.promptCache = new Map();
    }
    /**
     * Build prompt for chapter summary generation
     */
    buildChapterSummaryPrompt(chapterContent, globalSummary) {
        let template = this.getPrompt('generate-chapter-summary.md');
        template = template.replace('{{chapterContent}}', chapterContent);
        template = template.replace('{{globalSummary}}', globalSummary);
        return template;
    }
    /**
     * Build prompt for global summary update
     */
    buildGlobalSummaryUpdatePrompt(currentGlobalSummary, newChapterSummary, maxTokens) {
        let template = this.getPrompt('update-global-summary.md');
        template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary);
        template = template.replace('{{newChapterSummary}}', newChapterSummary);
        template = template.replace('{{maxTokens}}', maxTokens.toString());
        return template;
    }
    /**
     * Build prompt for character relationships update
     */
    buildCharacterRelationshipsUpdatePrompt(currentRelationships, currentGlobalSummary, newChapterSummary) {
        let template = this.getPrompt('update-character-relationships.md');
        template = template.replace('{{currentRelationships}}', currentRelationships || '(暂无)');
        template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary || '(暂无)');
        template = template.replace('{{newChapterSummary}}', newChapterSummary);
        return template;
    }
    /**
     * Build prompt for timeline update
     */
    buildTimelineUpdatePrompt(currentTimeline, currentGlobalSummary, newChapterSummary) {
        let template = this.getPrompt('update-timeline.md');
        template = template.replace('{{currentTimeline}}', currentTimeline || '(暂无)');
        template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary || '(暂无)');
        template = template.replace('{{newChapterSummary}}', newChapterSummary);
        return template;
    }
    /**
     * Build prompt for chapter plan update
     */
    buildChapterPlanUpdatePrompt(currentPlan, chapterNumber, chapterTitle, newChapterSummary) {
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
    buildCharacterCardUpdatePrompt(characterName, currentCard, currentGlobalSummary, newChapterSummary) {
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
    buildRebuildProjectStatePrompt(chapterSummaries, currentGlobalSummary, currentRelationships, maxTokens) {
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
    buildStyleCardPrompt(category, title, rawMaterial) {
        let template = this.getPrompt('analyze-style-material.md');
        template = template.replace('{{category}}', category);
        template = template.replace('{{title}}', title);
        template = template.replace('{{rawMaterial}}', rawMaterial);
        return template;
    }
    /**
     * Build prompt for global summary compression
     */
    buildCompressPrompt(originalSummary, targetTokens) {
        let template = this.getPrompt('compress-global-summary.md');
        template = template.replace('{{originalSummary}}', originalSummary);
        template = template.replace('{{targetTokens}}', targetTokens.toString());
        return template;
    }
    /**
     * Build prompt for content expansion
     */
    buildExpandPrompt(formattedContext) {
        let template = this.getPrompt('expand-content.md');
        template = template.replace('{{context}}', formattedContext);
        return template;
    }
    /**
     * Build prompt for consistency checking
     */
    buildConsistencyCheckPrompt(formattedContext, chapterContent) {
        let template = this.getPrompt('consistency-check.md');
        template = template.replace('{{context}}', formattedContext);
        template = template.replace('{{chapterContent}}', chapterContent);
        return template;
    }
    /**
     * Build prompt for chapter range review
     */
    buildArcReviewPrompt(chapterRangeLabel, globalSummary, timeline, chapterPlan, chapterSummaries) {
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
    buildNextChapterPlanningPrompt(targetChapter, globalSummary, timeline, chapterPlan, chapterSummaries, userIntent) {
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
    needsCompression(summary, maxTokens) {
        const tokens = (0, utils_1.estimateTokens)(summary);
        return tokens > maxTokens;
    }
    /**
     * Get prompt template from cache or file
     */
    getPrompt(name) {
        const candidatePaths = [
            path_1.default.join(process.cwd(), 'skills', 'novel-writer', 'prompts', name),
            path_1.default.join(this.skillRoot, 'prompts', name),
            path_1.default.resolve(this.skillRoot, '..', '..', 'skills', 'novel-writer', 'prompts', name),
        ];
        const filePath = candidatePaths.find(candidate => fs_1.default.existsSync(candidate));
        if (!filePath) {
            throw new Error(`Prompt template not found: ${name}`);
        }
        const stats = fs_1.default.statSync(filePath);
        const cached = this.promptCache.get(filePath);
        if (cached && cached.mtimeMs === stats.mtimeMs) {
            return cached.content;
        }
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        this.promptCache.set(filePath, {
            mtimeMs: stats.mtimeMs,
            content,
        });
        return content;
    }
}
exports.SummaryUpdater = SummaryUpdater;
