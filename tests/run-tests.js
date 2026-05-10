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
