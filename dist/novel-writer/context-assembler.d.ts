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
    formatContextForPrompt(context: AssembledContext): string;
    private calculateEstimatedTokens;
    private recalculateEstimatedTokens;
    private buildTailExcerpt;
    private sliceFromEnd;
    private stripChapterTitle;
    private extractStyleRequest;
    private selectStyleReferences;
    private selectCharacterCards;
}
