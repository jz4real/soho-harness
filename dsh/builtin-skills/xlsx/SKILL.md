---
name: xlsx
description: Use when creating, analysing, updating, or validating an XLSX, CSV, or TSV workbook for an internal Soho business task.
---

# Soho 表格分析

<!-- demo-fast-path: no-auto-install -->

处理表格时先读取用户指定文件并说明数据范围。计算字段使用公式而非写死的结果；
用户未提供阈值、口径或单位时先询问，不要臆造。

## 演示快速路径

1. CSV/TSV 可用 Python 标准库立即读取；XLSX 先检查 `openpyxl` 是否已存在。
2. 用已有的 `openpyxl` 创建或修改工作簿，保留原始输入文件。
3. 验证工作表名、表头、公式字符串、图表对象和 ZIP 完整性。

**不要自动安装** Python、openpyxl、pandas、LibreOffice、公式引擎或其他包；
不要下载镜像、查找镜像源或反复等待重算。若不存在 Excel/WPS/LibreOffice，设置
“打开时全量重算”，并说明缓存结果会在用户打开文件时生成。

## 交付规则

- 管理层工作簿默认包含概览、明细和风险提示；用户要求优先于默认结构。
- 图表应有标题、单位和来源；风险项必须说明规则或数据依据。
- 输出前只进行一次结构化检查，不能因可选渲染延迟交付。
