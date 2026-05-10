# 测试报告

- 测试时间：2026-05-10T06:19:27.843Z
- 临时项目目录：`C:\Users\lemon\AppData\Local\Temp\novel-writer-test-tMyk53`
- 总用例数：11
- 通过：11
- 失败：0

## 用例结果

- PASS create project and normalize config (15ms)
- PASS handler new creates isolated subdirectory project (18ms)
- PASS save chapter uses interpolated heading (4ms)
- PASS chapter draft workflow saves draft before finalize (19ms)
- PASS finalize can read edited draft file without re-pasting content (15ms)
- PASS chapter plan auto-sync writes markdown and json (3ms)
- PASS saving chapter summary auto-updates global project files (11ms)
- PASS context assembler excludes unrelated character cards (16ms)
- PASS context assembler respects maxContextTokens (7ms)
- PASS handler output no longer leaks broken placeholders (2ms)
- PASS review prompt includes target chapter summaries without broken placeholders (2ms)

## 结论

所有自动化测试均通过。核心链路包含项目创建、章节保存、章节计划同步、上下文裁剪与命令输出。