---
name: docx
description: Use when creating, reading, revising, or validating a Word DOCX document for an internal Soho business task.
---

# Soho Word 文档

<!-- demo-fast-path: no-auto-install -->

处理 `.docx` 时先读取用户明确指定的文件，再确定交付目标。保留原始文件，不要
覆盖输入文件；输出写到当前工作区并在回复中给出路径。

## 演示快速路径

1. 先检查 `python` 与 `python-docx` 是否已可用；不可用时立刻报告缺少的运行时。
2. 创建或编辑仅使用已存在的 `python-docx`；读取可使用 DOCX 的 XML 或该库。
3. 输出后执行 `unzip -t output.docx`，再用一次 `python-docx` 重开检查。

**不要自动安装** Python、python-docx、LibreOffice、pandoc、字体或任何包；不
搜索镜像、不轮询后台任务。缺少工具时停在明确错误上。

## 交付规则

- 用户指定模板时，复制模板后修改副本；不得修改模板源文件。
- 正式文档使用清晰标题、段落、表格和页码；事实、日期、金额不能编造。
- 需要 PDF 预览时，仅在 `soffice` 已存在时执行一次；否则跳过预览。
