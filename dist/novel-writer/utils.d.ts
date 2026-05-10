/**
 * Utility functions for novel writer
 */
/**
 * Rough token estimation: ~4 characters per token for Chinese
 * More accurate: ~1.3 characters per token for Chinese
 * We use 1.5 to be safe
 */
export declare function estimateTokens(text: string): number;
/**
 * Ensure directory exists, create if not
 */
export declare function ensureDir(dirPath: string): Promise<void>;
/**
 * Read file content with error handling
 */
export declare function readFile(filePath: string): Promise<string>;
/**
 * Write file with directory creation
 */
export declare function writeFile(filePath: string, content: string): Promise<void>;
/**
 * Count words (characters for Chinese)
 */
export declare function countWords(text: string): number;
/**
 * Format chapter number with leading zero
 */
export declare function formatChapterNumber(num: number): string;
/**
 * Parse global summary text into structured GlobalSummary
 */
export declare function parseGlobalSummary(text: string): any;
/**
 * Serialize GlobalSummary to markdown
 */
export declare function serializeGlobalSummary(summary: any): string;
