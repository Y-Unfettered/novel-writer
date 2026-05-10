/**
 * Content Generator - handles AI content generation
 */

import { AssembledContext } from './types';
import { ContextAssembler } from './context-assembler';
import { SummaryUpdater } from './summary-updater';

export class ContentGenerator {
  constructor(
    private contextAssembler: ContextAssembler,
    private summaryUpdater: SummaryUpdater
  ) {}

  /**
   * Build the full prompt for content generation
   */
  buildGenerationPrompt(context: AssembledContext): string {
    const formattedContext = this.contextAssembler.formatContextForPrompt(context);
    return this.summaryUpdater.buildExpandPrompt(formattedContext);
  }

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
  } {
    const globalSummary = this.estimateTokens(context.globalSummary);
    const timeline = this.estimateTokens(context.timeline);
    const chapterPlan = this.estimateTokens(context.chapterPlan);
    const characterCards = context.characterCards.reduce(
      (sum, card) => sum + this.estimateTokens(card.content),
      0
    );
    const recentSummaries = context.recentChapterSummaries.reduce(
      (sum, rs) => sum + this.estimateTokens(rs.summary),
      0
    );
    const recentFull = context.recentFullContents.reduce(
      (sum, rf) => sum + this.estimateTokens(rf.content),
      0
    );
    const styleReferences = context.styleReferences.reduce(
      (sum, ref) => sum + this.estimateTokens(ref.content),
      0
    );
    const userPrompt = this.estimateTokens(context.userPrompt);

    return {
      globalSummary,
      timeline,
      chapterPlan,
      characterCards,
      recentSummaries,
      recentFull,
      styleReferences,
      userPrompt,
      total: globalSummary + timeline + chapterPlan + characterCards + recentSummaries + recentFull + styleReferences + userPrompt + 200, // +overhead
    };
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 1.5);
  }
}
