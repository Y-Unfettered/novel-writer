"use strict";
/**
 * Type definitions for AI Novel Writer
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.DEFAULT_TOKEN_BUDGET = void 0;
exports.DEFAULT_TOKEN_BUDGET = {
    globalSummary: 1500,
    recentSummaries: 1000,
    recentFull: 3000,
    characterCards: 1200,
    styleReferences: 800,
    total: 5500,
};
exports.DEFAULT_CONFIG = {
    maxGlobalSummaryTokens: 1500,
    maxRecentFullChapters: 3,
    maxRecentChapterSummaries: 5,
    maxContextTokens: exports.DEFAULT_TOKEN_BUDGET.total,
    maxCharacterCards: 6,
    maxStyleReferences: 4,
};
