const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ProjectManager } = require('../dist/novel-writer/project-manager.js');
const { ContextAssembler } = require('../dist/novel-writer/context-assembler.js');
const handlerModule = require('../dist/novel-writer/index.js');

const handler = handlerModule.default || handlerModule.handler || handlerModule;

async function main() {
  const projectManager = new ProjectManager();
  const contextAssembler = new ContextAssembler(projectManager);
  const results = [];

  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'novel-writer-test-'));
  const originalCwd = process.cwd();

  try {
    process.chdir(tempRoot);

    await runTest(results, 'create project and normalize config', async () => {
      const project = await projectManager.createNewProject('测试小说', '测试作者', tempRoot, '江湖世界');
      assert.equal(project.title, '测试小说');
      const reloaded = await projectManager.loadProject(tempRoot);
      assert.equal(reloaded.config.maxContextTokens, 5500);
      assert.equal(reloaded.config.maxCharacterCards, 6);
      assert.equal(reloaded.config.maxStyleReferences, 4);
    });

    await runTest(results, 'handler new creates isolated subdirectory project', async () => {
      const output = await captureConsole(async () => {
        await handler({
          command: 'new',
          args: [],
          text: '# title: Temple Run\n# author: Test Author\n# setting: Ancient ruins\n# dir: temple-run',
        });
      });

      const projectDir = fs.readdirSync(tempRoot)
        .map(entry => path.join(tempRoot, entry, 'temple-run'))
        .find(candidate => fs.existsSync(path.join(candidate, 'novel.json')));
      assert.ok(projectDir, 'isolated project directory was not created');

      assert.ok(fs.existsSync(path.join(projectDir, 'novel.json')));
      assert.ok(output.includes(projectDir));
    });

    await runTest(results, 'save chapter uses interpolated heading', async () => {
      const project = await projectManager.loadProject(tempRoot);
      const chapter = await projectManager.saveChapter(project, 1, '风雪夜', '正文第一段\n正文第二段');
      const content = await projectManager.readChapterContent(chapter);
      assert.ok(content.startsWith('# 第1章 风雪夜'));
      assert.ok(!content.includes('{number}'));
    });

    await runTest(results, 'chapter draft workflow saves draft before finalize', async () => {
      const draftOutput = await captureConsole(async () => {
        await handler({
          command: 'write-draft',
          args: ['2', '山路'],
          text: '# 第2章 山路\n\n草稿正文第一段\n草稿正文第二段',
        });
      });

      const draftPath = path.join(tempRoot, 'chapters', 'drafts', '02-draft.md');
      assert.ok(fs.existsSync(draftPath));
      assert.ok(draftOutput.includes('正文草稿已保存'));

      const finalizeOutput = await captureConsole(async () => {
        await handler({
          command: 'finalize-chapter',
          args: ['2', '山路'],
          text: '# 第2章 山路\n\n定稿正文第一段\n定稿正文第二段',
        });
      });

      const finalPath = path.join(tempRoot, 'chapters', '02.md');
      const finalContent = await fs.promises.readFile(finalPath, 'utf8');
      const projectAfterFinalize = await projectManager.loadProject(tempRoot);
      const chapterAfterFinalize = projectManager.getChapter(projectAfterFinalize, 2);
      const finalSummary = await projectManager.readChapterSummary(chapterAfterFinalize);
      assert.ok(fs.existsSync(finalPath));
      assert.ok(finalSummary.trim().length > 0);
      assert.ok(finalContent.includes('定稿正文第一段'));
      assert.ok(finalizeOutput.includes('摘要已自动生成并同步到全局摘要、人物关系、时间线、章节计划和相关角色卡'));
    });

    await runTest(results, 'finalize can read edited draft file without re-pasting content', async () => {
      const draftPath = path.join(tempRoot, 'chapters', 'drafts', '03-draft.md');

      await captureConsole(async () => {
        await handler({
          command: 'write-draft',
          args: ['3', '夜行'],
          text: '# Chapter 3 Night Walk\n\nDraft line one\nDraft line two',
        });
      });

      await fs.promises.writeFile(
        draftPath,
        '# Chapter 3 Night Walk\n\nEdited line one\nEdited line two\n',
        'utf8'
      );

      const finalizeOutput = await captureConsole(async () => {
        await handler({
          command: 'finalize-chapter',
          args: ['3', '夜行'],
        });
      });

      const finalPath = path.join(tempRoot, 'chapters', '03.md');
      const finalContent = await fs.promises.readFile(finalPath, 'utf8');
      assert.ok(finalContent.includes('Edited line one'));
      assert.ok(finalizeOutput.includes('这一章已完成，可以直接开始下一章'));
    });

    await runTest(results, 'chapter plan auto-sync writes markdown and json', async () => {
      const project = await projectManager.loadProject(tempRoot);
      await projectManager.upsertChapterPlanEntry(project, {
        chapterNumber: 2,
        title: '山路',
        status: '草稿',
        goal: '主角下山',
        conflict: '遇袭',
        note: '待补正文',
      });

      const markdown = await projectManager.readChapterPlan(project);
      const jsonPath = path.join(tempRoot, 'planning', 'chapter-plan.json');
      const jsonEntries = JSON.parse(await fs.promises.readFile(jsonPath, 'utf8'));

      assert.ok(markdown.includes('| 2 | 山路 | 草稿 | 主角下山 | 遇袭 | 待补正文 |'));
      assert.equal(jsonEntries[1].chapterNumber, 2);
      assert.equal(jsonEntries[1].title, '山路');
    });

    await runTest(results, 'saving chapter summary auto-updates global project files', async () => {
      const beforeProject = await projectManager.loadProject(tempRoot);
      const beforeGlobalSummary = await projectManager.readGlobalSummary(beforeProject);
      const beforeRelationships = await projectManager.readCharacterRelationships(beforeProject);
      const beforeTimeline = await projectManager.readTimeline(beforeProject);
      const beforeChapterPlan = await projectManager.readChapterPlan(beforeProject);

      const output = await captureConsole(async () => {
        await handler({
          command: 'update-summary-done',
          args: ['2'],
          text: '林七与沈昭在山路上遭遇伏击，二人暂时结盟并发现一枚来历不明的黑铁令牌。',
        });
      });

      const project = await projectManager.loadProject(tempRoot);
      const globalSummary = await projectManager.readGlobalSummary(project);
      const relationships = await projectManager.readCharacterRelationships(project);
      const timeline = await projectManager.readTimeline(project);
      const chapterPlan = await projectManager.readChapterPlan(project);

      assert.notEqual(globalSummary, beforeGlobalSummary);
      assert.notEqual(relationships, beforeRelationships);
      assert.ok(timeline.includes('| 2 | 第2章 | 第2章 山路 |'));
      assert.ok(chapterPlan.includes('摘要与全局资料已自动同步'));
      assert.ok(chapterPlan.includes('| 2 | 山路 | 已完成 |'));
      assert.ok(output.includes('自动更新全局摘要、人物关系、时间线、章节计划'));
    });

    await runTest(results, 'save-chapter auto-syncs summary and project state', async () => {
      const isolatedRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'novel-writer-save-'));
      await projectManager.createNewProject('Auto Save', 'Tester', isolatedRoot, 'Test setting');
      const previousCwd = process.cwd();
      process.chdir(isolatedRoot);

      try {
        const beforeProject = await projectManager.loadProject(isolatedRoot);
        const beforeGlobalSummary = await projectManager.readGlobalSummary(beforeProject);

        const output = await captureConsole(async () => {
          await handler({
            command: 'save-chapter',
            args: ['1', 'Pass'],
            text: '# Chapter 1 Pass\n\nLin Yuan encountered \u706b\u7130\u9f20 at the mountain pass.\n\n\u706b\u7130\u9f20 burst out of the grass and forced everyone back.\n',
          });
        });

        const project = await projectManager.loadProject(isolatedRoot);
        const chapter = projectManager.getChapter(project, 1);
        const chapterSummary = await projectManager.readChapterSummary(chapter);
        const globalSummary = await projectManager.readGlobalSummary(project);

        assert.ok(chapterSummary.trim().length > 0, 'save-chapter should auto-generate a summary');
        assert.notEqual(globalSummary, beforeGlobalSummary, 'save-chapter should auto-sync global summary');
        assert.ok(output.includes('\u6458\u8981\u5df2\u81ea\u52a8\u751f\u6210\u5e76\u540c\u6b65'), 'output should mention auto-sync');
      } finally {
        process.chdir(previousCwd);
      }
    });

    await runTest(results, 'creature extraction ignores noisy non-creature phrases', async () => {
      const isolatedRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'novel-writer-creature-'));
      await projectManager.createNewProject('Creature Filter', 'Tester', isolatedRoot, 'Test setting');
      const previousCwd = process.cwd();
      process.chdir(isolatedRoot);

      try {
        const project = await projectManager.loadProject(isolatedRoot);
        await projectManager.saveChapter(
          project,
          1,
          'Noise Check',
          '\u6797\u6e0a\u5b89\u6392\u5b69\u5b50\u8eb2\u5f00\uff0c\u6309\u4f4f\u77f3\u95e8\uff0c\u770b\u89c1\u4e86\u9e1f\u86cb\u3002\u968f\u540e\u706b\u7130\u9f20\u4ece\u8349\u4e1b\u7a9c\u51fa\u3002'
        );
        await projectManager.saveProject(project);

        await captureConsole(async () => {
          await handler({
            command: 'update-summary-done',
            args: ['1'],
            text: '\u6797\u6e0a\u5b89\u6392\u5b69\u5b50\u8eb2\u907f\u5371\u9669\uff0c\u6309\u4f4f\u77f3\u95e8\u65f6\u770b\u89c1\u4e86\u9e1f\u86cb\u6eda\u843d\uff0c\u968f\u540e\u706b\u7130\u9f20\u4ece\u8349\u4e1b\u7a9c\u51fa\u3002',
          });
        });

        const reloaded = await projectManager.loadProject(isolatedRoot);
        const creatureCards = await projectManager.readAllCreatureCards(reloaded);
        const creatureNames = creatureCards.map(card => card.name);
        const fireMouse = await projectManager.findCreatureCard(reloaded, '\u706b\u7130\u9f20');

        assert.ok(creatureNames.includes('\u706b\u7130\u9f20'), 'should keep the real creature name');
        assert.ok(!creatureNames.includes('\u5b89\u6392\u5b69\u5b50'), 'should not treat action phrases as creatures');
        assert.ok(!creatureNames.includes('\u6309\u4f4f'), 'should not treat verbs as creatures');
        assert.ok(!creatureNames.includes('\u9e1f\u86cb'), 'should not treat eggs as creatures');
        assert.ok(!creatureNames.some(name => name.includes('\u968f\u540e')), 'should not keep narrative adverbs in creature names');
        assert.ok(fireMouse && fireMouse.card.chapterRecords.length > 0, 'creature cards should record chapter updates');
      } finally {
        process.chdir(previousCwd);
      }
    });

    await runTest(results, 'context assembler excludes unrelated character cards', async () => {
      const project = await projectManager.loadProject(tempRoot);
      await projectManager.saveCharacterCard(project, '张三', '张三角色卡');
      await projectManager.saveCharacterCard(project, '李四', '李四角色卡');

      const context = await contextAssembler.assembleContext(project, 2, '本章只有风景描写，没有角色出场');
      assert.deepEqual(context.characterCards, []);
    });

    await runTest(results, 'context assembler respects maxContextTokens', async () => {
      const project = await projectManager.loadProject(tempRoot);
      project.config.maxContextTokens = 600;
      project.config.maxRecentFullChapters = 2;
      project.config.maxRecentChapterSummaries = 2;
      project.config.maxCreatureCards = 0;

      await projectManager.saveChapterSummary(project.chapters[0], '第一章摘要'.repeat(60));
      await projectManager.saveChapter(project, 2, '长路', '第二章正文'.repeat(800));
      await projectManager.saveChapterSummary(projectManager.getChapter(project, 2), '第二章摘要'.repeat(60));
      await projectManager.saveProject(project);

      const context = await contextAssembler.assembleContext(project, 3, '调用风格：环境，动作\n主角继续赶路');
      assert.ok(context.estimatedTokens <= 900, `estimatedTokens=${context.estimatedTokens}`);
    });

    await runTest(results, 'handler output no longer leaks broken placeholders', async () => {
      const output = await captureConsole(async () => {
        await handler({ command: '上下文', args: ['3'], text: '主角继续赶路' });
      });

      assert.ok(output.includes('全局摘要：'));
      assert.ok(output.includes('最近章节摘要'));
      assert.ok(!output.includes('{stats.'));
      assert.ok(!output.includes('{chapter.'));
      assert.ok(!output.includes('{project.'));
    });

    await runTest(results, 'review prompt includes target chapter summaries without broken placeholders', async () => {
      const output = await captureConsole(async () => {
        await handler({ command: '复盘', args: ['1', '2'] });
      });

      assert.ok(output.includes('第一章摘要'));
      assert.ok(output.includes('第二章摘要'));
      assert.ok(output.includes('阶段复盘'));
      assert.ok(!output.includes('{resolvedStart}'));
      assert.ok(!output.includes('{chapter.number}'));
    });

    // ========== 生物卡片系统测试 ==========

    await runTest(results, 'create and read creature card', async () => {
      const project = await projectManager.loadProject('d:/小说/小说管理/墟烬之主');
      const card = projectManager.buildDefaultCreatureCard('火焰鼠', '野兽', '第1章', '低');
      card.appearance.size = '小型';
      card.appearance.features = '通体火红皮毛';
      card.abilities.attack = '啃咬';
      card.abilities.weakness = '怕水';

      const filePath = await projectManager.saveCreatureCardFromObject(project, '野兽', '火焰鼠', card);
      assert.ok(fs.existsSync(filePath));

      const readCard = await projectManager.readCreatureCard(project, '野兽', '火焰鼠');
      assert.ok(readCard !== null);
      assert.equal(readCard.name, '火焰鼠');
      assert.equal(readCard.category, '野兽');
      assert.equal(readCard.baseDangerLevel, '低');
      assert.equal(readCard.appearance.size, '小型');
      assert.equal(readCard.abilities.weakness, '怕水');
    });

    await runTest(results, 'creature card category management', async () => {
      const project = await projectManager.loadProject('d:/小说/小说管理/墟烬之主');

      const categories = await projectManager.readCreatureCategories(project);
      assert.ok(categories.length > 0, '应该有生物分类目录');
      assert.ok(categories.includes('野兽'), '应该有野兽分类');

      await projectManager.saveCreatureCard(project, '毒蛇', '鳞类', '# 毒蛇\n描述', '中');
      const cards = await projectManager.readCreatureCards(project, '鳞类');
      assert.ok(cards.length > 0, '鳞类应该有生物卡片');
      const snakeCard = cards.find(c => c.name === '毒蛇');
      assert.ok(snakeCard, '应该找到毒蛇卡片');
    });

    await runTest(results, 'plant-like names fall into other creature category', async () => {
      const isolatedRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'novel-writer-plant-'));
      await projectManager.createNewProject('Plant Category', 'Tester', isolatedRoot, 'Test setting');
      const previousCwd = process.cwd();
      process.chdir(isolatedRoot);

      try {
        const project = await projectManager.loadProject(isolatedRoot);
        await projectManager.saveChapter(
          project,
          1,
          'Forest',
          '\u6797\u6e0a\u5728\u5c71\u95f4\u770b\u89c1\u4e03\u661f\u8349\u53d1\u5149\uff0c\u65c1\u8fb9\u8001\u69d0\u6811\u76d8\u6839\u9519\u8282\u3002'
        );
        await projectManager.saveProject(project);

        await captureConsole(async () => {
          await handler({
            command: 'update-summary-done',
            args: ['1'],
            text: '\u672c\u7ae0\u4e2d\u51fa\u73b0\u4e03\u661f\u8349\u4e0e\u8001\u69d0\u6811\uff0c\u4e24\u8005\u90fd\u5c5e\u4e8e\u690d\u7269\u690d\u682a\u7c7b\u7d20\u6750\u3002',
          });
        });

        const reloaded = await projectManager.loadProject(isolatedRoot);
        const qixingcao = await projectManager.findCreatureCard(reloaded, '\u4e03\u661f\u8349');
        const huaishu = await projectManager.findCreatureCard(reloaded, '\u8001\u69d0\u6811');

        assert.ok(qixingcao, 'should create a card for ???');
        assert.ok(huaishu, 'should create a card for ???');
        assert.equal(qixingcao.category, '\u5176\u4ed6');
        assert.equal(huaishu.category, '\u5176\u4ed6');
      } finally {
        process.chdir(previousCwd);
      }
    });

    await runTest(results, 'creature danger level update', async () => {
      const project = await projectManager.loadProject('d:/小说/小说管理/墟烬之主');

      await projectManager.updateCreatureDangerLevel(
        project,
        '野兽',
        '火焰鼠',
        2,
        '中',
        '危险生物',
        '林渊受伤',
        '遭遇新威胁'
      );

      const card = await projectManager.readCreatureCard(project, '野兽', '火焰鼠');
      assert.ok(card !== null);
      assert.ok(card.dangerLevelHistory.length > 0, '应该有危险等级历史记录');

      const chapter2Entry = card.dangerLevelHistory.find(h => h.chapterNumber === 2);
      assert.ok(chapter2Entry, '应该有第2章的记录');
      assert.equal(chapter2Entry.dangerLevel, '中');
      assert.equal(chapter2Entry.threatLevel, '危险生物');
      assert.equal(chapter2Entry.protagonistStatus, '林渊受伤');
    });

    await runTest(results, 'context assembler includes creature cards', async () => {
      const project = await projectManager.loadProject('d:/小说/小说管理/墟烬之主');

      const card = projectManager.buildDefaultCreatureCard('林渊', '神话人仙', '第1章', '中');
      card.abilities.attack = '神力';
      await projectManager.saveCreatureCardFromObject(project, '神话人仙', '林渊', card);

      const fireMouseCard = projectManager.buildDefaultCreatureCard('火焰鼠', '野兽', '第1章', '低');
      fireMouseCard.appearance.size = '小型';
      fireMouseCard.abilities.attack = '啃咬';
      await projectManager.saveCreatureCardFromObject(project, '野兽', '火焰鼠', fireMouseCard);

      const context = await contextAssembler.assembleContext(
        project,
        2,
        '\u6797\u6e0a\u9047\u5230\u706b\u7130\u9f20',
        { maxContextTokens: 20000, maxCreatureCards: 4 }
      );

      assert.ok(Array.isArray(context.creatureCards), 'creatureCards 应该是数组');
      assert.ok(context.creatureCards.length >= 2, '应该有至少2张生物卡片被选中，当前: ' + context.creatureCards.length);

      const creatureCardNames = context.creatureCards.map(c => c.name);
      assert.ok(creatureCardNames.includes('火焰鼠'), '上下文应该包含火焰鼠生物卡片，当前卡片: ' + creatureCardNames.join(', '));
      assert.ok(creatureCardNames.includes('林渊'), '上下文应该包含林渊生物卡片');
    });

    await runTest(results, 'creature danger level history records', async () => {
      const project = await projectManager.loadProject('d:/小说/小说管理/墟烬之主');

      await projectManager.updateCreatureDangerLevel(
        project,
        '野兽',
        '火焰鼠',
        3,
        '高',
        '致命威胁',
        '林渊中毒',
        '火焰鼠变异'
      );

      const card = await projectManager.readCreatureCard(project, '野兽', '火焰鼠');
      assert.ok(card !== null);
      assert.ok(card.dangerLevelHistory.length >= 2, '应该有至少2条危险等级历史');

      const chapter3Entry = card.dangerLevelHistory.find(h => h.chapterNumber === 3);
      assert.ok(chapter3Entry, '应该有第3章的记录');
      assert.equal(chapter3Entry.dangerLevel, '高');
      assert.equal(chapter3Entry.threatLevel, '致命威胁');
      assert.equal(chapter3Entry.note, '火焰鼠变异');

      const sortedHistory = card.dangerLevelHistory;
      for (let i = 1; i < sortedHistory.length; i++) {
        assert.ok(
          sortedHistory[i].chapterNumber >= sortedHistory[i - 1].chapterNumber,
          '危险等级历史应该按章节号排序'
        );
      }
    });
  } finally {
    process.chdir(originalCwd);
  }

  const report = buildMarkdownReport(results, tempRoot);
  await fs.promises.mkdir(path.join(originalCwd, 'docs'), { recursive: true });
  await fs.promises.writeFile(path.join(originalCwd, 'docs', 'test-report.md'), report, 'utf8');

  console.log(report);

  if (results.some(result => result.status === 'failed')) {
    process.exitCode = 1;
  }
}

async function runTest(results, name, fn) {
  const startedAt = Date.now();
  try {
    await fn();
    results.push({ name, status: 'passed', durationMs: Date.now() - startedAt });
  } catch (error) {
    results.push({
      name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.stack || error.message : String(error),
    });
  }
}

async function captureConsole(fn) {
  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args) => {
    logs.push(args.join(' '));
  };
  console.error = (...args) => {
    logs.push(args.join(' '));
  };

  try {
    await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return logs.join('\n');
}

function buildMarkdownReport(results, tempRoot) {
  const passed = results.filter(result => result.status === 'passed').length;
  const failed = results.filter(result => result.status === 'failed');

  const lines = [
    '# 测试报告',
    '',
    `- 测试时间：${new Date().toISOString()}`,
    `- 临时项目目录：\`${tempRoot}\``,
    `- 总用例数：${results.length}`,
    `- 通过：${passed}`,
    `- 失败：${failed.length}`,
    '',
    '## 用例结果',
    '',
  ];

  for (const result of results) {
    lines.push(`- ${result.status === 'passed' ? 'PASS' : 'FAIL'} ${result.name} (${result.durationMs}ms)`);
    if (result.error) {
      lines.push('```text');
      lines.push(result.error);
      lines.push('```');
    }
  }

  lines.push('');
  if (failed.length === 0) {
    lines.push('## 结论');
    lines.push('');
    lines.push('所有自动化测试均通过。核心链路包含项目创建、章节保存、章节计划同步、上下文裁剪与命令输出。');
  } else {
    lines.push('## 结论');
    lines.push('');
    lines.push('存在未通过项，请根据上面的错误信息继续修复。');
  }

  return lines.join('\n');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
