/**
 * Summary Updater - generates and updates chapter and global summaries
 */

import fs from 'fs';
import path from 'path';
import { estimateTokens } from './utils';

export class SummaryUpdater {
  private promptCache: Map<string, { mtimeMs: number; content: string }> = new Map();

  constructor(private skillRoot: string) {}

  /**
   * Build prompt for chapter summary generation
   */
  buildChapterSummaryPrompt(chapterContent: string, globalSummary: string): string {
    let template = this.getPrompt('generate-chapter-summary.md');
    template = template.replace('{{chapterContent}}', chapterContent);
    template = template.replace('{{globalSummary}}', globalSummary);
    return template;
  }

  /**
   * Build prompt for global summary update
   */
  buildGlobalSummaryUpdatePrompt(
    currentGlobalSummary: string,
    newChapterSummary: string,
    maxTokens: number
  ): string {
    let template = this.getPrompt('update-global-summary.md');
    template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary);
    template = template.replace('{{newChapterSummary}}', newChapterSummary);
    template = template.replace('{{maxTokens}}', maxTokens.toString());
    return template;
  }

  /**
   * Build prompt for character relationships update
   */
  buildCharacterRelationshipsUpdatePrompt(
    currentRelationships: string,
    currentGlobalSummary: string,
    newChapterSummary: string
  ): string {
    let template = this.getPrompt('update-character-relationships.md');
    template = template.replace('{{currentRelationships}}', currentRelationships || '(暂无)');
    template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary || '(暂无)');
    template = template.replace('{{newChapterSummary}}', newChapterSummary);
    return template;
  }

  /**
   * Build prompt for timeline update
   */
  buildTimelineUpdatePrompt(
    currentTimeline: string,
    currentGlobalSummary: string,
    newChapterSummary: string
  ): string {
    let template = this.getPrompt('update-timeline.md');
    template = template.replace('{{currentTimeline}}', currentTimeline || '(暂无)');
    template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary || '(暂无)');
    template = template.replace('{{newChapterSummary}}', newChapterSummary);
    return template;
  }

  /**
   * Build prompt for chapter plan update
   */
  buildChapterPlanUpdatePrompt(
    currentPlan: string,
    chapterNumber: number,
    chapterTitle: string,
    newChapterSummary: string
  ): string {
    let template = this.getPrompt('update-chapter-plan.md');
    template = template.replace('{{currentPlan}}', currentPlan || '(暂无)');
    template = template.replace('{{chapterNumber}}', chapterNumber.toString());
    template = template.replace('{{chapterTitle}}', chapterTitle || '待定');
    template = template.replace('{{newChapterSummary}}', newChapterSummary);
    return template;
  }

  /**
   * Build prompt for character card update
   */
  buildCharacterCardUpdatePrompt(
    characterName: string,
    currentCard: string,
    currentGlobalSummary: string,
    newChapterSummary: string
  ): string {
    let template = this.getPrompt('update-character-card.md');
    template = template.replace('{{characterName}}', characterName);
    template = template.replace('{{currentCard}}', currentCard || '(暂无)');
    template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary || '(暂无)');
    template = template.replace('{{newChapterSummary}}', newChapterSummary);
    return template;
  }

  /**
   * Build prompt for rebuilding project state from existing chapter summaries
   */
  buildRebuildProjectStatePrompt(
    chapterSummaries: string,
    currentGlobalSummary: string,
    currentRelationships: string,
    maxTokens: number
  ): string {
    let template = this.getPrompt('rebuild-project-state.md');
    template = template.replace('{{chapterSummaries}}', chapterSummaries);
    template = template.replace('{{currentGlobalSummary}}', currentGlobalSummary || '(暂无)');
    template = template.replace('{{currentRelationships}}', currentRelationships || '(暂无)');
    template = template.replace('{{maxTokens}}', maxTokens.toString());
    return template;
  }

  /**
   * Build prompt for distilling a raw style material into a style card
   */
  buildStyleCardPrompt(category: string, title: string, rawMaterial: string): string {
    let template = this.getPrompt('analyze-style-material.md');
    template = template.replace('{{category}}', category);
    template = template.replace('{{title}}', title);
    template = template.replace('{{rawMaterial}}', rawMaterial);
    return template;
  }

  /**
   * Build prompt for global summary compression
   */
  buildCompressPrompt(originalSummary: string, targetTokens: number): string {
    let template = this.getPrompt('compress-global-summary.md');
    template = template.replace('{{originalSummary}}', originalSummary);
    template = template.replace('{{targetTokens}}', targetTokens.toString());
    return template;
  }

  /**
   * Build prompt for content expansion
   */
  buildExpandPrompt(formattedContext: string): string {
    let template = this.getPrompt('expand-content.md');
    template = template.replace('{{context}}', formattedContext);
    return template;
  }

  /**
   * Build prompt for consistency checking
   */
  buildConsistencyCheckPrompt(
    formattedContext: string,
    chapterContent: string
  ): string {
    let template = this.getPrompt('consistency-check.md');
    template = template.replace('{{context}}', formattedContext);
    template = template.replace('{{chapterContent}}', chapterContent);
    return template;
  }

  /**
   * Build prompt for chapter range review
   */
  buildArcReviewPrompt(
    chapterRangeLabel: string,
    globalSummary: string,
    timeline: string,
    chapterPlan: string,
    chapterSummaries: string
  ): string {
    let template = this.getPrompt('review-arc.md');
    template = template.replace('{{chapterRangeLabel}}', chapterRangeLabel);
    template = template.replace('{{globalSummary}}', globalSummary || '(暂无)');
    template = template.replace('{{timeline}}', timeline || '(暂无)');
    template = template.replace('{{chapterPlan}}', chapterPlan || '(暂无)');
    template = template.replace('{{chapterSummaries}}', chapterSummaries || '(暂无)');
    return template;
  }

  /**
   * Build prompt for next chapter planning
   */
  buildNextChapterPlanningPrompt(
    targetChapter: number,
    globalSummary: string,
    timeline: string,
    chapterPlan: string,
    chapterSummaries: string,
    userIntent: string
  ): string {
    let template = this.getPrompt('plan-next-chapter.md');
    template = template.replace('{{targetChapter}}', targetChapter.toString());
    template = template.replace('{{globalSummary}}', globalSummary || '(暂无)');
    template = template.replace('{{timeline}}', timeline || '(暂无)');
    template = template.replace('{{chapterPlan}}', chapterPlan || '(暂无)');
    template = template.replace('{{chapterSummaries}}', chapterSummaries || '(暂无)');
    template = template.replace('{{userIntent}}', userIntent || '(暂无额外要求)');
    return template;
  }

  /**
   * Build prompt for creature card generation
   */
  buildCreatureCardPrompt(creatureName: string, context: string): string {
    return `## 生物卡片生成任务

请为以下生物生成完整的《山海经》风格卡片。

### 生物名称
${creatureName}

### 上下文信息
${context || '(暂无)'}

### 输出要求
请生成以下格式的生物卡片：

\`\`\`
【生物名称】：（中文名称，可根据描述自行推断）

【危险等级】：（1-5级，1为无害，5为致命）
- 外观危险度：[1-5] （描述看起来的危险程度）
- 实际危险度：[1-5] （实际战斗中的危险程度）
- 威胁范围：[1-5] （对人类社会的影响范围）

【外观描述】：
- 形体：[详细描述体型、外形]
- 特征：[显著特征，如角、羽、鳞等]
- 颜色：[主要颜色]
- 特殊视觉效果：[如发光、雾气等]

【能力体系】：
- 核心能力：[主要能力]
- 辅助能力：[次要能力]
- 特殊机制：[如再生、变形等]
- 弱点：[已知弱点]

【生态信息】：
- 栖息地：[分布区域]
- 行为习性：[行动模式]
- 繁殖方式：[如有]
- 天敌：[已知天敌]

【危险等级评估】：
- 战斗建议：[应对策略]
- 致命程度：[描述]
- 注意事项：[特殊警告]

【用途价值】：
- 药用价值：[如有]
- 材料价值：[如可作为武器材料等]
- 驯养可能性：[1-5]
- 研究价值：[学术价值]

【典籍记载】：
[山海经风格的古文描述，2-3句]
\`\`\`

请确保：
1. 危险等级评估需综合考虑外观、实际战斗力和威胁范围
2. 能力描述需具体且有区分度
3. 弱点必须合理且可能被主角利用
4. 典籍记载需符合《山海经》的语言风格`;
  }

  /**
   * Build prompt for creature summary generation
   */
  buildCreatureSummaryPrompt(creatureName: string, creatureCard: string): string {
    return `## 生物简述生成任务

请根据以下生物卡片，生成一段简洁的生物简述，用于快速了解该生物。

### 生物名称
${creatureName}

### 生物卡片
${creatureCard || '(暂无)'}

### 输出要求
请生成一段100-200字的简述，包含：
1. 一句话概括该生物的核心特征
2. 外观要点（1-2句）
3. 危险等级和主要威胁（1-2句）
4. 特殊能力或价值（1-2句）

### 格式
以自然段落形式输出，不要使用列表格式。

### 示例风格
"此兽名曰XXX，形体如XX，其色XX。见之则避，莫敢前也。其性XX，好食XX。有XX之能，若遇之，可XX以对。"`;
  }

  /**
   * Build prompt for auto-generating new creature card draft
   */
  buildAutoCreatureCardPrompt(
    currentCreatureCards: string,
    chapterContent: string,
    newCreatureName?: string
  ): string {
    return `## 自动生成新生物卡片任务

请根据最新章节内容，自动生成新发现的生物卡片。

### 已有的生物卡片
${currentCreatureCards || '(暂无已有生物卡片)'}

### 最新章节内容
${chapterContent}

### 指定生物名称（可选）
${newCreatureName || '(未指定，请自行从内容中识别)'}

### 任务要求
1. 识别章节中新出现的生物
2. 如果指定了生物名称，优先为该生物生成卡片
3. 如果未指定，从新生物中选择最有记录价值的一个

### 输出要求
请生成以下格式的生物卡片：

\`\`\`
【生物名称】：（中文名称）

【危险等级】：（1-5级）
- 外观危险度：[1-5]
- 实际危险度：[1-5]
- 威胁范围：[1-5]

【外观描述】：
- 形体：[描述]
- 特征：[特征]
- 颜色：[颜色]

【能力体系】：
- 核心能力：[能力]
- 辅助能力：[能力]
- 特殊机制：[机制]
- 弱点：[弱点]

【生态信息】：
- 栖息地：[分布]
- 行为习性：[习性]
- 繁殖方式：[方式]
- 天敌：[天敌]

【危险等级评估】：
- 战斗建议：[建议]
- 致命程度：[程度]
- 注意事项：[注意]

【用途价值】：
- 药用价值：[价值]
- 材料价值：[价值]
- 驯养可能性：[1-5]
- 研究价值：[价值]

【典籍记载】：
[山海经风格描述]
\`\`\`

### 判断标准
在决定是否为某生物生成卡片时，请考虑：
- 该生物是否具有独特能力或特征
- 该生物是否对剧情有重要影响
- 该生物是否具有研究或利用价值
- 该生物的危险等级是否值得记录`;
  }

  /**
   * Build prompt for danger level assessment
   */
  buildDangerLevelUpdatePrompt(
    creatureName: string,
    currentCreatureCard: string,
    newChapterSummary: string
  ): string {
    return `## 危险等级评估更新任务

请根据最新章节内容，评估并更新该生物的危险等级。

### 生物名称
${creatureName}

### 当前生物卡片
${currentCreatureCard || '(暂无)'}

### 最新章节内容摘要
${newChapterSummary}

### 评估维度
请从以下三个维度重新评估危险等级：

1. **外观危险度（1-5）**
   - 该生物的外观给观察者带来的恐惧程度
   - 考虑：体型、色彩、特殊标记、诡异程度

2. **实际危险度（1-5）**
   - 该生物在实战中的威胁程度
   - 考虑：攻击能力、防御能力、特殊机制、战斗智慧

3. **威胁范围（1-5）**
   - 该生物对人类社会的影响范围
   - 考虑：活动范围、群体规模、环境破坏力、社会恐慌度

### 输出格式
请按以下格式输出评估结果：

\`\`\`
【危险等级更新】

【变化分析】：
- 外观危险度变化：[↑/↓/-] 变化原因：[说明]
- 实际危险度变化：[↑/↓/-] 变化原因：[说明]
- 威胁范围变化：[↑/↓/-] 变化原因：[说明]

【当前危险等级】：
- 外观危险度：[1-5]
- 实际危险度：[1-5]
- 威胁范围：[1-5]
- 综合等级：[1-5] （取三者平均，向上取整）

【危险等级公式】：
综合等级 = ceil((外观危险度 + 实际危险度 + 威胁范围) / 3)

【威胁描述】：
[一段话描述该生物当前的整体威胁程度]

【应对建议】：
[针对该生物的应对策略，如有新的战斗经验请一并更新]
\`\`\`

### 注意事项
1. 如果该生物在最新章节中有新的战斗表现，请据此调整危险等级
2. 如果发现新的弱点或应对方法，请在"应对建议"中更新
3. 危险等级变化需要有明确的章节内容支撑
4. 威胁描述应客观反映该生物在当前剧情阶段的位置`;
  }

  /**
   * Check if global summary needs compression
   */
  needsCompression(summary: string, maxTokens: number): boolean {
    const tokens = estimateTokens(summary);
    return tokens > maxTokens;
  }

  /**
   * Get prompt template from cache or file
   */
  private getPrompt(name: string): string {
    const candidatePaths = [
      path.join(process.cwd(), 'skills', 'novel-writer', 'prompts', name),
      path.join(this.skillRoot, 'prompts', name),
      path.resolve(this.skillRoot, '..', '..', 'skills', 'novel-writer', 'prompts', name),
    ];
    const filePath = candidatePaths.find(candidate => fs.existsSync(candidate));

    if (!filePath) {
      throw new Error(`Prompt template not found: ${name}`);
    }

    const stats = fs.statSync(filePath);
    const cached = this.promptCache.get(filePath);
    if (cached && cached.mtimeMs === stats.mtimeMs) {
      return cached.content;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    this.promptCache.set(filePath, {
      mtimeMs: stats.mtimeMs,
      content,
    });
    return content;
  }
}
