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
  characterCards: Array<{ name: string; content: string }>;
  recentChapterSummaries: Array<{ number: number; summary: string }>;
  recentFullContents: Array<{ number: number; content: string }>;
  styleReferences: Array<{ category: string; name: string; content: string }>;
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

export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  globalSummary: 1500,
  recentSummaries: 1000,
  recentFull: 3000,
  characterCards: 1200,
  styleReferences: 800,
  total: 5500,
};

export const DEFAULT_CONFIG = {
  maxGlobalSummaryTokens: 1500,
  maxRecentFullChapters: 3,
  maxRecentChapterSummaries: 5,
  maxContextTokens: DEFAULT_TOKEN_BUDGET.total,
  maxCharacterCards: 6,
  maxStyleReferences: 4,
};
