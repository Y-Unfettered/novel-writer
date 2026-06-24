# 测试报告

- 测试时间：2026-06-24T03:56:29.653Z
- 临时项目目录：`C:\Users\lemon\AppData\Local\Temp\novel-writer-test-yRh8f6`
- 总用例数：19
- 通过：19
- 失败：0

## 用例结果

- PASS create project and normalize config (26ms)
- PASS handler new creates isolated subdirectory project (23ms)
- PASS save chapter uses interpolated heading (2ms)
- PASS chapter draft workflow saves draft before finalize (27ms)
- PASS finalize can read edited draft file without re-pasting content (33ms)
- PASS chapter plan auto-sync writes markdown and json (3ms)
- PASS saving chapter summary auto-updates global project files (26ms)
- PASS save-chapter auto-syncs summary and project state (69ms)
- PASS creature extraction ignores noisy non-creature phrases (70ms)
- PASS context assembler excludes unrelated character cards (11ms)
- PASS context assembler respects maxContextTokens (11ms)
- PASS handler output no longer leaks broken placeholders (7ms)
- PASS review prompt includes target chapter summaries without broken placeholders (1ms)
- PASS create and read creature card (2ms)
- PASS creature card category management (3ms)
- PASS plant-like names fall into other creature category (62ms)
- PASS creature danger level update (2ms)
- PASS context assembler includes creature cards (12ms)
- PASS creature danger level history records (2ms)

## 结论

所有自动化测试均通过。核心链路包含项目创建、章节保存、章节计划同步、上下文裁剪与命令输出。