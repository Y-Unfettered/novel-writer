/**
 * Summary Updater - generates and updates chapter and global summaries
 */
export declare class SummaryUpdater {
    private skillRoot;
    private promptCache;
    constructor(skillRoot: string);
    /**
     * Build prompt for chapter summary generation
     */
    buildChapterSummaryPrompt(chapterContent: string, globalSummary: string): string;
    /**
     * Build prompt for global summary update
     */
    buildGlobalSummaryUpdatePrompt(currentGlobalSummary: string, newChapterSummary: string, maxTokens: number): string;
    /**
     * Build prompt for character relationships update
     */
    buildCharacterRelationshipsUpdatePrompt(currentRelationships: string, currentGlobalSummary: string, newChapterSummary: string): string;
    /**
     * Build prompt for timeline update
     */
    buildTimelineUpdatePrompt(currentTimeline: string, currentGlobalSummary: string, newChapterSummary: string): string;
    /**
     * Build prompt for chapter plan update
     */
    buildChapterPlanUpdatePrompt(currentPlan: string, chapterNumber: number, chapterTitle: string, newChapterSummary: string): string;
    /**
     * Build prompt for character card update
     */
    buildCharacterCardUpdatePrompt(characterName: string, currentCard: string, currentGlobalSummary: string, newChapterSummary: string): string;
    /**
     * Build prompt for rebuilding project state from existing chapter summaries
     */
    buildRebuildProjectStatePrompt(chapterSummaries: string, currentGlobalSummary: string, currentRelationships: string, maxTokens: number): string;
    /**
     * Build prompt for distilling a raw style material into a style card
     */
    buildStyleCardPrompt(category: string, title: string, rawMaterial: string): string;
    /**
     * Build prompt for global summary compression
     */
    buildCompressPrompt(originalSummary: string, targetTokens: number): string;
    /**
     * Build prompt for content expansion
     */
    buildExpandPrompt(formattedContext: string): string;
    /**
     * Build prompt for consistency checking
     */
    buildConsistencyCheckPrompt(formattedContext: string, chapterContent: string): string;
    /**
     * Build prompt for chapter range review
     */
    buildArcReviewPrompt(chapterRangeLabel: string, globalSummary: string, timeline: string, chapterPlan: string, chapterSummaries: string): string;
    /**
     * Build prompt for next chapter planning
     */
    buildNextChapterPlanningPrompt(targetChapter: number, globalSummary: string, timeline: string, chapterPlan: string, chapterSummaries: string, userIntent: string): string;
    /**
     * Build prompt for creature card generation
     */
    buildCreatureCardPrompt(creatureName: string, context: string): string;
    /**
     * Build prompt for creature summary generation
     */
    buildCreatureSummaryPrompt(creatureName: string, creatureCard: string): string;
    /**
     * Build prompt for auto-generating new creature card draft
     */
    buildAutoCreatureCardPrompt(currentCreatureCards: string, chapterContent: string, newCreatureName?: string): string;
    /**
     * Build prompt for danger level assessment
     */
    buildDangerLevelUpdatePrompt(creatureName: string, currentCreatureCard: string, newChapterSummary: string): string;
    /**
     * Check if global summary needs compression
     */
    needsCompression(summary: string, maxTokens: number): boolean;
    /**
     * Get prompt template from cache or file
     */
    private getPrompt;
}
