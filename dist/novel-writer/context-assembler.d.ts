/**
 * Context Assembler - assembles context from different layers with token budgeting
 */
import { AssembledContext, ContextOptions, NovelProject } from './types';
import { ProjectManager } from './project-manager';
export declare class ContextAssembler {
    private projectManager;
    private static readonly EXCERPT_SAFETY_BUFFER_TOKENS;
    constructor(projectManager: ProjectManager);
    assembleContext(project: NovelProject, targetChapter: number, userPrompt: string, options?: ContextOptions): Promise<AssembledContext>;
    trimContextIfNeeded(context: AssembledContext, maxTokens: number): Promise<AssembledContext>;
    recalculateEstimatedTokens(context: AssembledContext): AssembledContext;
    formatContextForPrompt(context: AssembledContext): string;
    private stripChapterTitle;
    private trimExcerpt;
    private selectStyleReferences;
    private selectCharacterCards;
    private getCurrentDangerLevel;
    private selectCreatureCards;
}
