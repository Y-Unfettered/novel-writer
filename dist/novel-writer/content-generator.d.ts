/**
 * Content Generator - handles AI content generation
 */
import { AssembledContext } from './types';
import { ContextAssembler } from './context-assembler';
import { SummaryUpdater } from './summary-updater';
export declare class ContentGenerator {
    private contextAssembler;
    private summaryUpdater;
    constructor(contextAssembler: ContextAssembler, summaryUpdater: SummaryUpdater);
    /**
     * Build the full prompt for content generation
     */
    buildGenerationPrompt(context: AssembledContext): string;
    /**
     * Get token statistics for reporting
     */
    getTokenStats(context: AssembledContext): {
        globalSummary: number;
        timeline: number;
        chapterPlan: number;
        characterCards: number;
        recentSummaries: number;
        recentFull: number;
        styleReferences: number;
        userPrompt: number;
        total: number;
    };
    private estimateTokens;
}
