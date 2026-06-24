# AI Novel Writer - Code Wiki

## 1. 项目概述

### 1.1 项目简介

**AI 小说长篇写作辅助工具** (novel-writer) 是一套面向 Claude Code 的智能写作 Skill，专注于辅助长篇小说创作。核心设计理念是将作者从繁琐的上下文管理中解放出来，让 AI 负责组织上下文、生成提示词、维护摘要与结构化资料。

### 1.2 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| TypeScript | ^5.3.3 | 主要开发语言 |
| Node.js | - | 运行时环境 |
| Claude Code CLI | - | Skill 运行环境 |

### 1.3 项目结构

```
d:\小说\
├── skills/                    # TypeScript 源代码
│   └── novel-writer/
│       ├── index.ts           # 主入口，命令处理器
│       ├── types.ts           # 类型定义
│       ├── project-manager.ts # 项目管理器
│       ├── context-assembler.ts# 上下文组装器
│       ├── content-generator.ts# 内容生成器
│       ├── summary-updater.ts # 摘要更新器
│       ├── utils.ts           # 工具函数
│       └── prompts/           # Prompt 模板目录
│
├── dist/                      # 编译输出 (JavaScript)
│   └── novel-writer/
│       ├── *.js               # 编译后的模块
│       └── prompts/           # 编译后的 Prompt 模板
│
├── tests/                     # 测试脚本
│   └── run-tests.js           # 自动化测试入口
│
├── docs/                      # 文档与报告
│   ├── test-report.md         # 测试报告
│   └── optimization-iterations.md # 优化迭代记录
│
├── 小说管理/                  # 小说项目存储目录
│   └── <小说名>/             # 单本小说项目
│       ├── novel.json         # 项目元数据
│       ├── global-summary.md  # 全局摘要
│       ├── chapters/          # 章节目录
│       ├── characters/        # 角色资料目录
│       ├── planning/          # 规划目录
│       ├── references/        # 参考素材目录
│       ├── creatures/         # 生物卡片目录
│       └── snapshots/         # 快照目录
│
├── package.json               # 项目配置
├── tsconfig.json             # TypeScript 配置
└── README.md                 # 项目说明文档
```

---

## 2. 核心模块架构

### 2.1 模块依赖关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                         index.ts                                 │
│                    (命令入口 & 处理器)                           │
└─────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐       ┌─────────────────┐       ┌───────────────┐
│ProjectManager │       │ContextAssembler  │       │ContentGenerator│
│   (项目)      │       │   (上下文)       │       │   (内容生成)   │
└───────────────┘       └─────────────────┘       └───────────────┘
                                                              │
                              ┌─────────────────┐              │
                              │ SummaryUpdater  │◄─────────────┘
                              │  (摘要更新)     │
                              └─────────────────┘
                                      │
                              ┌─────────────────┐
                              │     utils.ts    │
                              │   (工具函数)    │
                              └─────────────────┘
```

### 2.2 各模块职责

| 模块 | 职责 | 核心类/函数 |
|------|------|-------------|
| `index.ts` | 命令路由、用户交互、工作流编排 | `handler()`, 各 `handle*` 函数 |
| `project-manager.ts` | 项目 CRUD、文件 I/O、目录结构维护 | `ProjectManager` 类 |
| `context-assembler.ts` | 上下文组装、Token 预算控制、选择性加载 | `ContextAssembler` 类 |
| `content-generator.ts` | Prompt 构建、Token 统计 | `ContentGenerator` 类 |
| `summary-updater.ts` | Prompt 模板管理、摘要生成提示词 | `SummaryUpdater` 类 |
| `utils.ts` | 通用工具函数 | 各种纯函数 |

---

## 3. 类型系统 (types.ts)

### 3.1 核心接口

#### NovelProject - 小说项目
```typescript
interface NovelProject {
  title: string;              // 小说标题
  author: string;            // 作者
  rootPath: string;          // 项目根目录
  createdAt: number;          // 创建时间戳
  updatedAt: number;          // 更新时间戳
  totalChapters: number;     // 总章节数
  currentChapter: number;     // 当前章节
  config: ProjectConfig;     // 项目配置
  chapters: ChapterInfo[];    // 章节列表
  pendingChapterDraft?: PendingChapterDraft; // 待处理草稿
}
```

#### ProjectConfig - 项目配置
```typescript
interface ProjectConfig {
  maxGlobalSummaryTokens: number;    // 全局摘要上限 (默认 1500)
  maxRecentFullChapters: number;      // 最近完整章节数 (默认 3)
  maxRecentChapterSummaries: number;  // 最近摘要章节数 (默认 5)
  maxContextTokens: number;            // 上下文总预算 (默认 5500)
  maxCharacterCards: number;           // 角色卡上限 (默认 6)
  maxStyleReferences: number;         // 风格参考卡上限 (默认 4)
  maxCreatureCards: number;           // 生物卡上限 (默认 4)
}
```

#### ChapterInfo - 章节信息
```typescript
interface ChapterInfo {
  number: number;       // 章节号
  title: string;        // 章节标题
  contentPath: string;  // 正文文件路径
  summaryPath: string;  // 摘要文件路径
  wordCount: number;    // 字数
  createdAt: number;    // 创建时间
  updatedAt: number;    // 更新时间
}
```

#### PendingChapterDraft - 待处理草稿
```typescript
interface PendingChapterDraft {
  number: number;           // 章节号
  title: string;            // 标题
  prompt: string;           // 用户提供的要点
  confirmedOutline?: string; // 确认后的章节方案
  draftPath?: string;       // 草稿文件路径
  draftContent?: string;     // 草稿内容
  updatedAt: number;        // 更新时间
}
```

#### AssembledContext - 组装后的上下文
```typescript
interface AssembledContext {
  globalSummary: string;                          // 全局摘要
  timeline: string;                               // 时间线
  chapterPlan: string;                            // 章节计划
  characterCards: Array<{ name: string; content: string }>;  // 角色卡
  creatureCards: Array<{...}>;                    // 生物卡
  recentChapterSummaries: Array<{ number: number; summary: string }>; // 章节摘要
  recentFullContents: Array<{ number: number; content: string }>;     // 完整正文
  styleReferences: Array<{ category: string; name: string; content: string }>; // 风格参考
  userPrompt: string;                              // 用户要点
  estimatedTokens: number;                         // 估算 Token 数
}
```

### 3.2 生物卡片类型

```typescript
type CreatureCategory = '神话异兽' | '野兽' | '虫类' | '禽类' | '鳞类' | '神话人仙' | '其他';
type DangerLevel = '极高' | '高' | '中' | '低' | '无害';
type ThreatLevel = '致命威胁' | '危险生物' | '潜在威胁' | '相对安全';

interface CreatureCard {
  name: string;                    // 名称
  category: CreatureCategory;       // 分类
  firstAppearance: string;          // 首次出场
  baseDangerLevel: DangerLevel;     // 基础危险等级
  appearance: {                     // 外观描述
    size: string;
    features: string;
    colors: string;
    specialMarks: string;
  };
  abilities: {                     // 能力属性
    attack: string;
    defense: string;
    special: string;
    weakness: string;
  };
  ecology: {                       // 生态习性
    habitat: string;
    activityPattern: string;
    diet: string;
    socialBehavior: string;
  };
  utility: {                       // 实用价值
    edible: string;
    material: string;
    medicinal: string;
    other: string;
  };
  distribution: {                   // 分布区域
    mainAreas: string;
    range: string;
    humanRelation: string;
  };
  dangerLevelHistory: DangerLevelHistoryEntry[];  // 危险等级历史
  chapterRecords: string[];         // 章节出场记录
}
```

---

## 4. 模块详解

### 4.1 index.ts - 命令入口

**职责**: 作为 Skill 的主入口，负责命令路由、工作流编排和用户交互。

**核心导出**:
```typescript
export default async function handler(args: {
  command: string;
  args: string[];
  text?: string;
}): Promise<void>
```

**命令分类**:

| 类别 | 命令 | 功能 |
|------|------|------|
| 项目管理 | `新建` | 创建新小说项目 |
| 章节工作流 | `规划章节` → `确认章节` → `写正文` → `保存定稿` | 完整章节创作流程 |
| 章节操作 | `续写`, `跳转`, `保存章节正文`, `阅读` | 章节读写 |
| 摘要管理 | `更新摘要`, `保存章节摘要`, `保存全局摘要` | 摘要维护 |
| 资料管理 | `保存人物关系`, `保存角色卡`, `保存时间线`, `保存章节计划` | 资料维护 |
| 素材管理 | `保存素材`, `分析素材`, `保存风格卡`, `风格库` | 风格参考 |
| 生物系统 | `保存生物卡`, `生物卡`, `生物库`, `更新生物危险`, `生物卡历史` | 生物卡片管理 |
| 辅助功能 | `状态`, `快照`, `自检`, `复盘`, `规划下一章`, `上下文`, `压缩`, `重建资料`, `帮助` | 辅助工具 |

**标准工作流**:
```
1. /novel 规划章节 [章节号] [标题] <本章需求>
   → 记录本章需求，进入确认阶段

2. /novel 确认章节 [章节号] [标题] <章节方案>
   → 确认章节方案，进入正文写作阶段

3. /novel 写正文 [章节号] [标题]
   → 助手生成正文并写入草稿文件

4. /novel 保存定稿 [章节号] [标题]
   → 自动同步摘要、全局资料、角色卡等
```

### 4.2 ProjectManager - 项目管理器

**职责**: 负责项目的创建、加载、保存，以及所有文件 I/O 操作。

**主要方法**:

| 方法 | 功能 |
|------|------|
| `createNewProject()` | 创建新项目，初始化目录结构 |
| `loadProject()` | 加载项目，规范化路径 |
| `saveProject()` | 保存项目元数据 |
| `saveChapter()` | 保存章节正文 |
| `saveChapterDraft()` | 保存草稿 |
| `saveChapterSummary()` | 保存章节摘要 |
| `readChapterContent()` | 读取章节正文 |
| `readChapterSummary()` | 读取章节摘要 |
| `saveGlobalSummary()` | 保存全局摘要 |
| `saveCharacterCard()` | 保存角色卡 |
| `readCharacterCards()` | 读取角色卡列表 |
| `saveChapterPlan()` | 保存章节计划 |
| `upsertChapterPlanEntry()` | 更新章节计划条目 |
| `createProjectSnapshot()` | 创建项目快照 |
| `saveCreatureCard()` | 保存生物卡片 |
| `readCreatureCard()` | 读取生物卡片 |
| `updateCreatureDangerLevel()` | 更新危险等级 |

**项目目录结构**:
```
<项目根目录>/
├── novel.json              # 项目元数据
├── global-summary.md       # 全局摘要
├── chapters/
│   ├── 01.md              # 第1章正文
│   ├── 01-summary.md       # 第1章摘要
│   ├── 02.md
│   ├── 02-summary.md
│   └── drafts/            # 草稿目录
│       ├── 01-draft.md
│       └── 02-draft.md
├── characters/
│   ├── 人物关系.md         # 人物关系文档
│   └── cards/             # 角色卡目录
│       ├── 张三.md
│       └── 李四.md
├── planning/
│   ├── timeline.md        # 时间线
│   ├── chapter-plan.md     # 章节计划 (Markdown)
│   └── chapter-plan.json  # 章节计划 (JSON)
├── references/
│   ├── raw/               # 原始素材
│   └── cards/             # 风格卡
├── creatures/             # 生物卡片目录
│   ├── 神话异兽/
│   ├── 野兽/
│   ├── 虫类/
│   ├── 禽类/
│   ├── 鳞类/
│   └── 其他/
└── snapshots/            # 快照目录
```

### 4.3 ContextAssembler - 上下文组装器

**职责**: 根据用户需求和 Token 预算，组装最佳的写作上下文。

**核心方法**:

| 方法 | 功能 |
|------|------|
| `assembleContext()` | 组装完整上下文 |
| `formatContextForPrompt()` | 格式化为 Prompt 字符串 |
| `trimContextIfNeeded()` | 超出预算时智能裁剪 |

**Token 预算控制策略**:
```
裁剪优先级:
1. 减少最近完整正文
2. 减少最近章节摘要
3. 减少风格参考卡
4. 减少角色卡
5. 减少生物卡
6. 将最后一章正文压缩为"结尾节选"
7. 将最后一章摘要压缩为"压缩版摘要"
```

**上下文组装内容**:
1. 全局摘要
2. 章节计划
3. 时间线
4. 相关角色卡 (按名称匹配)
5. 相关生物卡 (按名称匹配)
6. 最近章节摘要
7. 最近完整正文
8. 风格参考卡 (支持 `调用风格：环境，动作` 语法)
9. 用户要点

### 4.4 ContentGenerator - 内容生成器

**职责**: 构建内容生成 Prompt，统计 Token 使用情况。

**主要方法**:

| 方法 | 功能 |
|------|------|
| `buildGenerationPrompt()` | 构建正文生成 Prompt |
| `getTokenStats()` | 获取 Token 统计信息 |

### 4.5 SummaryUpdater - 摘要更新器

**职责**: 管理 Prompt 模板，生成各类摘要更新提示词。

**主要方法**:

| 方法 | 功能 |
|------|------|
| `buildChapterSummaryPrompt()` | 章节摘要生成提示词 |
| `buildGlobalSummaryUpdatePrompt()` | 全局摘要更新提示词 |
| `buildCharacterRelationshipsUpdatePrompt()` | 人物关系更新提示词 |
| `buildTimelineUpdatePrompt()` | 时间线更新提示词 |
| `buildChapterPlanUpdatePrompt()` | 章节计划更新提示词 |
| `buildCharacterCardUpdatePrompt()` | 角色卡更新提示词 |
| `buildStyleCardPrompt()` | 风格卡生成提示词 |
| `buildCompressPrompt()` | 全局摘要压缩提示词 |
| `buildExpandPrompt()` | 正文扩展提示词 |
| `buildConsistencyCheckPrompt()` | 一致性检查提示词 |
| `buildArcReviewPrompt()` | 阶段复盘提示词 |
| `buildNextChapterPlanningPrompt()` | 下一章规划提示词 |

### 4.6 utils.ts - 工具函数

| 函数 | 功能 |
|------|------|
| `estimateTokens()` | 估算 Token 数 (中文 ~1.5 字符/token) |
| `ensureDir()` | 确保目录存在 |
| `readFile()` | 读取文件 |
| `writeFile()` | 写入文件 |
| `countWords()` | 统计字数 |
| `formatChapterNumber()` | 格式化章节号 (补零) |
| `parseGlobalSummary()` | 解析全局摘要 |
| `serializeGlobalSummary()` | 序列化全局摘要 |

---

## 5. 命令系统

### 5.1 完整命令列表

| 中文命令 | 英文别名 | 参数 | 功能 |
|----------|----------|------|------|
| `新建` | `new` | - | 创建新小说项目 |
| `规划章节` | `plan-chapter` | [章节号] [标题] <需求> | 记录本章需求 |
| `确认章节` | `confirm-chapter` | [章节号] [标题] <方案> | 确认章节方案 |
| `写正文` | `write-draft` | [章节号] [标题] | 生成正文上下文 |
| `保存定稿` | `finalize-chapter` | [章节号] [标题] | 定稿并同步资料 |
| `续写` | `continue` | [章节号] [标题] <要点> | 续写下一章 |
| `跳转` | `jump` | <章节号> <要点> | 跳章写作 |
| `保存章节正文` | `save-chapter` | [章节号] [标题] <正文> | 保存正文 |
| `更新摘要` | `update-summary` | [章节号] | 生成摘要提示词 |
| `保存章节摘要` | `update-summary-done` | [章节号] <摘要> | 保存摘要 |
| `保存全局摘要` | `apply-global-summary` | <内容> | 保存全局摘要 |
| `保存人物关系` | - | <内容> | 保存人物关系 |
| `保存角色卡` | `save-character-card` | <角色名> <内容> | 保存角色卡 |
| `保存时间线` | `save-timeline` | <内容> | 保存时间线 |
| `保存章节计划` | `save-chapter-plan` | <内容> | 保存章节计划 |
| `快照` | `snapshot` | [名称] | 创建快照 |
| `保存素材` | - | <分类> <名称> <素材> | 保存原始素材 |
| `分析素材` | - | <分类> <名称> | 生成风格卡提示词 |
| `保存风格卡` | - | <分类> <名称> <内容> | 保存风格卡 |
| `状态` | `status` | - | 查看项目状态 |
| `人物关系` | - | - | 查看人物关系 |
| `角色卡` | `character-cards` | [关键词] | 查看角色卡 |
| `时间线` | `timeline` | - | 查看时间线 |
| `章节计划` | `plan` | - | 查看章节计划 |
| `阅读` | `read` | <章节号> | 阅读章节 |
| `风格库` | - | - | 查看风格卡 |
| `压缩` | `compress` | - | 生成压缩提示词 |
| `重建资料` | - | - | 重建全局资料 |
| `自检` | `consistency-check` | [章节号] | 一致性检查 |
| `复盘` | `review-arc` | [起始] [结束] | 阶段复盘 |
| `规划下一章` | `plan-next` | [章节号] | 规划下一章 |
| `上下文` | `context-preview` | [章节号] [要点] | 查看上下文 |
| `帮助` | `help` | - | 显示帮助 |
| `保存生物卡` | - | <分类> <名称> <内容> | 保存生物卡 |
| `生物卡` | - | [关键词] | 查看生物卡 |
| `生物库` | - | - | 查看生物库 |
| `更新生物危险` | - | <名称> <章节> <等级> | 更新危险等级 |
| `生物卡历史` | - | <名称> | 查看危险历史 |
| `保存生物素材` | - | <分类> <名称> <素材> | 保存生物素材 |
| `分析生物` | - | <分类> <名称> | 分析生物 |

### 5.2 命令使用示例

```bash
# 创建新项目
/novel 新建
# 标题：神庙逃亡
# 作者：作者名
# 设定：背景设定...

# 标准工作流
/novel 规划章节 3 第三章标题
本章要写的内容...

/novel 确认章节 3 第三章标题
确认的章节方案...

/novel 写正文 3 第三章标题
# 助手会自动生成正文并写入草稿

/novel 保存定稿 3 第三章标题
# 自动同步摘要和全局资料

# 查看项目状态
/novel 状态

# 创建快照
/novel 快照 卷一改稿前

# 一致性检查
/novel 自检 3

# 上下文预览
/novel 上下文 3 主角继续赶路
```

---

## 6. 生物卡片系统

### 6.1 生物分类

| 分类 | 说明 |
|------|------|
| `神话异兽` | 神兽、妖怪、神话生物 |
| `野兽` | 野生动物、猛兽 |
| `虫类` | 昆虫、节肢动物 |
| `禽类` | 鸟类 |
| `鳞类` | 鱼类、爬行动物 |
| `神话人仙` | 人形神话生物 |
| `其他` | 其他生物 |

### 6.2 危险等级

| 等级 | 威胁程度 | 说明 |
|------|----------|------|
| `极高` | 致命威胁 | 遭遇即可能死亡 |
| `高` | 危险生物 | 需要谨慎应对 |
| `中` | 潜在威胁 | 需要注意 |
| `低` | 相对安全 | ，但仍需小心 |
| `无害` | 相对安全 | 对人类无威胁 |

### 6.3 生物卡自动管理

系统在章节定稿时会自动：
1. 从章节摘要中提取生物名称
2. 为新生物创建卡片草稿
3. 追加生物出场记录
4. 根据章节号自动评估/更新危险等级

---

## 7. 配置系统

### 7.1 项目级配置 (novel.json)

```json
{
  "config": {
    "maxGlobalSummaryTokens": 1500,
    "maxRecentFullChapters": 3,
    "maxRecentChapterSummaries": 5,
    "maxContextTokens": 5500,
    "maxCharacterCards": 6,
    "maxStyleReferences": 4,
    "maxCreatureCards": 4
  }
}
```

### 7.2 配置项说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `maxGlobalSummaryTokens` | 1500 | 全局摘要的目标上限 |
| `maxRecentFullChapters` | 3 | 上下文保留的完整正文章节数 |
| `maxRecentChapterSummaries` | 5 | 上下文保留的摘要章节数 |
| `maxContextTokens` | 5500 | 整体上下文预算 |
| `maxCharacterCards` | 6 | 一次带入的角色卡上限 |
| `maxStyleReferences` | 4 | 一次带入的风格卡上限 |
| `maxCreatureCards` | 4 | 一次带入的生物卡上限 |

---

## 8. 编译与测试

### 8.1 编译

```bash
npm run build
# 输出到 dist/ 目录
```

### 8.2 测试

```bash
npm test
# 运行自动化测试
# 测试报告输出到 docs/test-report.md
```

### 8.3 测试覆盖范围

- 项目创建与配置规范化
- 章节保存与草稿工作流
- 章节计划自动同步
- 摘要与全局资料自动更新
- 上下文组装与 Token 控制
- 生物卡片系统
- 命令输出格式

---

## 9. 扩展指南

### 9.1 添加新命令

1. 在 `index.ts` 中添加 `handle*` 函数
2. 在 `handler` 的 switch 语句中添加 case
3. 在 `commands` 数组中注册命令元数据

### 9.2 添加新 Prompt 模板

1. 在 `skills/novel-writer/prompts/` 创建模板文件
2. 使用 `{{variable}}` 占位符
3. 在 `SummaryUpdater` 中添加对应的构建方法

### 9.3 添加新数据类型

1. 在 `types.ts` 中添加类型定义
2. 在 `ProjectManager` 中添加相关 CRUD 方法
3. 在 `ContextAssembler` 中添加上下文组装逻辑

---

## 10. 常见问题

### Q: 如何在多个小说之间切换？
A: 每个小说项目是独立的目录。进入对应目录后，所有命令都只在该项目内生效。

### Q: Token 超出预算怎么办？
A: 系统会自动裁剪，优先保留最重要的上下文。也可以手动运行 `/novel 压缩` 生成压缩提示词。

### Q: 如何备份项目？
A: 使用 `/novel 快照 [名称]` 创建项目快照，会复制核心资料到 snapshots 目录。

### Q: 生物卡片如何自动更新？
A: 章节定稿时会自动从摘要中提取生物名称，创建卡片草稿并更新危险等级。

---

*文档生成时间: 2026-05-10*
