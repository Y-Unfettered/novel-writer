/**
 * Type definitions for AI Novel Writer
 */
export interface NovelProject {
    title: string;
    author: string;
    rootPath: string;
    createdAt: number;
    updatedAt: number;
    totalChapters: number;
    currentChapter: number;
    config: {
        maxGlobalSummaryTokens: number;
        maxRecentFullChapters: number;
        maxRecentChapterSummaries: number;
        maxContextTokens: number;
        maxCharacterCards: number;
        maxStyleReferences: number;
        maxCreatureCards: number;
    };
    chapters: ChapterInfo[];
    pendingChapterDraft?: PendingChapterDraft;
}
export interface PendingChapterDraft {
    number: number;
    title: string;
    prompt: string;
    confirmedOutline?: string;
    draftPath?: string;
    draftContent?: string;
    updatedAt: number;
}
export interface ChapterInfo {
    number: number;
    title: string;
    contentPath: string;
    summaryPath: string;
    wordCount: number;
    createdAt: number;
    updatedAt: number;
}
export interface ChapterPlanEntry {
    chapterNumber: number;
    title: string;
    status: string;
    goal: string;
    conflict: string;
    note: string;
}
export interface CharacterSummary {
    name: string;
    description: string;
    status: 'active' | 'inactive' | 'completed';
}
export interface GlobalSummary {
    setting: string;
    characters: CharacterSummary[];
    mainPlot: string;
    clues: string[];
    completedArcs: string[];
}
export interface ChapterSummary {
    chapterNumber: number;
    chapterTitle: string;
    keyEvents: string[];
    newCharacters: CharacterSummary[];
    plotProgress: string;
    clues: string[];
    affectsGlobal: boolean;
}
export interface AssembledContext {
    globalSummary: string;
    timeline: string;
    chapterPlan: string;
    characterCards: Array<{
        name: string;
        content: string;
    }>;
    creatureCards: Array<{
        name: string;
        content: string;
        category: string;
        currentDangerLevel: string;
        currentThreatLevel: string;
    }>;
    recentChapterSummaries: Array<{
        number: number;
        summary: string;
    }>;
    recentFullContents: Array<{
        number: number;
        content: string;
    }>;
    styleReferences: Array<{
        category: string;
        name: string;
        content: string;
    }>;
    userPrompt: string;
    estimatedTokens: number;
}
export interface ContextOptions {
    maxGlobalSummaryTokens?: number;
    maxRecentFullChapters?: number;
    maxRecentChapterSummaries?: number;
    maxContextTokens?: number;
    maxCharacterCards?: number;
    maxStyleReferences?: number;
    maxCreatureCards?: number;
}
export interface GenerateOptions {
    temperature?: number;
    maxTokens?: number;
}
export interface TokenBudget {
    globalSummary: number;
    recentSummaries: number;
    recentFull: number;
    characterCards: number;
    styleReferences: number;
    total: number;
}
export declare const DEFAULT_TOKEN_BUDGET: TokenBudget;
export declare const DEFAULT_CONFIG: {
    maxGlobalSummaryTokens: number;
    maxRecentFullChapters: number;
    maxRecentChapterSummaries: number;
    maxContextTokens: number;
    maxCharacterCards: number;
    maxStyleReferences: number;
    maxCreatureCards: number;
};
export type CreatureCategory = '神话异兽' | '野兽' | '虫类' | '禽类' | '鳞类' | '植株';
export type DangerLevel = '极高' | '高' | '中' | '低' | '无害';
export type ThreatLevel = '致命威胁' | '危险生物' | '潜在威胁' | '相对安全';
export interface DangerLevelHistoryEntry {
    chapterNumber: number;
    dangerLevel: DangerLevel;
    threatLevel: ThreatLevel;
    protagonistStatus: string;
    note: string;
}
export interface CreatureCard {
    name: string;
    category: CreatureCategory;
    firstAppearance: string;
    baseDangerLevel: DangerLevel;
    appearance: {
        size: string;
        features: string;
        colors: string;
        specialMarks: string;
    };
    abilities: {
        attack: string;
        defense: string;
        special: string;
        weakness: string;
    };
    ecology: {
        habitat: string;
        activityPattern: string;
        diet: string;
        socialBehavior: string;
    };
    utility: {
        edible: string;
        material: string;
        medicinal: string;
        other: string;
    };
    distribution: {
        mainAreas: string;
        range: string;
        humanRelation: string;
    };
    dangerLevelHistory: DangerLevelHistoryEntry[];
    chapterRecords: string[];
}
export interface CreatureCardSummary {
    name: string;
    category: CreatureCategory;
    currentDangerLevel: DangerLevel;
    currentThreatLevel: ThreatLevel;
    description: string;
}
