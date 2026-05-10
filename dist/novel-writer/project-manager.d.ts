/**
 * Project Manager - handles project creation, loading, saving
 */
import { ChapterInfo, NovelProject } from './types';
export declare class ProjectManager {
    createNewProject(title: string, author: string, rootPath: string, basicSetting: string): Promise<NovelProject>;
    loadProject(projectPath: string): Promise<NovelProject>;
    saveProject(project: NovelProject): Promise<void>;
    saveChapter(project: NovelProject, chapterNumber: number, chapterTitle: string, content: string): Promise<ChapterInfo>;
    saveChapterDraft(project: NovelProject, chapterNumber: number, chapterTitle: string, content: string): Promise<string>;
    readChapterContent(chapter: ChapterInfo): Promise<string>;
    readChapterSummary(chapter: ChapterInfo): Promise<string>;
    saveChapterSummary(chapter: ChapterInfo, summary: string): Promise<void>;
    readGlobalSummary(project: NovelProject): Promise<string>;
    saveGlobalSummary(project: NovelProject, summary: string): Promise<void>;
    readCharacterRelationships(project: NovelProject): Promise<string>;
    saveCharacterRelationships(project: NovelProject, content: string): Promise<void>;
    readTimeline(project: NovelProject): Promise<string>;
    saveTimeline(project: NovelProject, content: string): Promise<void>;
    readChapterPlan(project: NovelProject): Promise<string>;
    saveChapterPlan(project: NovelProject, content: string): Promise<void>;
    upsertChapterPlanEntry(project: NovelProject, entry: {
        chapterNumber: number;
        title?: string;
        status?: string;
        goal?: string;
        conflict?: string;
        note?: string;
    }): Promise<void>;
    saveCharacterCard(project: NovelProject, name: string, content: string): Promise<string>;
    readCharacterCards(project: NovelProject): Promise<Array<{
        name: string;
        content: string;
        path: string;
    }>>;
    saveStyleReferenceRaw(project: NovelProject, category: string, name: string, content: string): Promise<string>;
    saveStyleReferenceCard(project: NovelProject, category: string, name: string, content: string): Promise<string>;
    createProjectSnapshot(project: NovelProject, label?: string): Promise<string>;
    readStyleReferenceCards(project: NovelProject): Promise<Array<{
        category: string;
        name: string;
        content: string;
        path: string;
    }>>;
    readStyleReferenceRawMaterials(project: NovelProject): Promise<Array<{
        category: string;
        name: string;
        content: string;
        path: string;
    }>>;
    getChapter(project: NovelProject, number: number): ChapterInfo | undefined;
    getSortedChapters(project: NovelProject): ChapterInfo[];
    getLastNChapters(project: NovelProject, n: number, beforeChapter?: number): ChapterInfo[];
    private buildInitialGlobalSummary;
    private buildInitialCharacterRelationships;
    private buildInitialCharacterCardGuide;
    private buildInitialTimeline;
    private buildInitialChapterPlanEntries;
    private createDefaultChapterPlanEntry;
    private buildInitialChapterPlan;
    private renderChapterPlanMarkdown;
    private buildInitialStyleReferenceGuide;
    private sanitizeFileName;
    private parseStyleReferenceFileName;
    private wrapChapterContent;
    private wrapCharacterCardContent;
    private buildSnapshotTimestamp;
    private copySnapshotItem;
    private normalizeLoadedProject;
    private toStoredProject;
    private rebaseStoredPath;
    private buildStyleReferenceFileName;
    private wrapStyleReferenceContent;
    private parseStyleReferenceContent;
    private parseCharacterCardContent;
    private readStyleReferenceDirectory;
    private readChapterPlanEntries;
    private saveChapterPlanEntries;
    private parseChapterPlanMarkdown;
    private mergeChapterPlanEntry;
}
