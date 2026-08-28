---
name: meeting-proposal
description: Use when drafting a Chinese group party committee, president office, or board proposal that must follow the supplied Soho Word template.
---

# 会议议案模板

<!-- demo-fast-path: no-auto-install -->

用于生成正式中文议案。优先使用用户上传的材料；缺少决定性事实时只提出一个
问题，不编造审批结论、附件或落款。

## 演示快速路径

1. 检查 `python` 能否导入 `docx`；失败则立即说明“需要由管理员预装
   python-docx”，不要自动安装任何软件或依赖。
2. 用 `scripts/extract_docx.py` 读取用户指定的 DOCX 一次。
3. 生成符合下面结构的 JSON，再用 `scripts/create_proposal.py` 和
   `assets/集团党委会、总裁办公会、董事会议案格式模板.docx` 输出 DOCX。
4. 只执行一次 `unzip -t` 验证输出；不要进行渲染、搜索替代工具或下载。

脚本、模板和本技能路径均相对于当前技能目录；不得假设 `$HOME`、macOS 路径或
Codex 专用运行时。

```json
{
  "meeting_type": "集团总裁办公会",
  "title": "关于……的议案",
  "submit_unit": "数字化管理部",
  "submit_date": "2026年8月27日",
  "decision": "同意……，并授权……。",
  "sections": [{"heading": "一、议案背景", "paragraphs": ["……"]}],
  "attachments": []
}
```
