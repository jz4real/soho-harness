---
name: pptx
description: Use when creating, reading, revising, or validating a PowerPoint PPTX or template for an internal Soho management presentation.
---

# Soho 汇报演示文稿

<!-- demo-fast-path: no-auto-install -->

生成或编辑 `.pptx` 时先读取用户明确提供的材料、模板和 Logo；没有模板或已存在的
生成器时，不要手写 OOXML 来伪造演示文稿。

## 演示快速路径

1. 检查 `python-pptx` 或 `pptxgenjs` 是否已可用；只做这一次检查。
2. 若可用，创建 16:9 演示文稿，优先结论、关键数据、风险、下一步和需决策事项。
3. 输出后执行 `unzip -t output.pptx`；若现有环境有可用验证器，再执行一次验证。

**不要自动安装** Node 包、Python 包、LibreOffice、字体、Docker 镜像或图片处理
依赖；不要下载、不搜索全局目录、不重试长时间卡住的预览。生成器缺失时立即报告，
并建议管理员在演示前一次性安装运行时。

## 交付规则

- 每页不超过三条核心信息，管理层汇报先结论后依据。
- 仅使用用户明确指定的品牌素材；没有明确素材时使用文字标题。
- 用户要求修改既有 PPT 时，复制后修改副本，保留原文件。
