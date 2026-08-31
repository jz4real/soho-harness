# 源码维护的 MaxKB 标签页实施计划

[English](2026-08-28-source-owned-maxkb-tabs.md) | 中文

> **供 agent 工作者使用：** 必须使用子技能 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项执行本计划。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 用由源码维护、可在干净 macOS 或 Windows clone 后运行的右侧 `Files | MaxKB` 工作台，替换 MaxKB 固定浮层。

**架构：** 保留 `@soho/dsh-maxkb-panel` 作为唯一 client 扩展。它拥有小型标签状态，只在其 MaxKB 标签内渲染受信任的 MaxKB iframe。设置脚本仍是唯一的 profile 注册入口。

**技术栈：** DSH client runtime、React JSX runtime、Node test runner、PowerShell/cmd 启动器。

**规格：** `docs/superpowers/specs/2026-08-28-source-owned-maxkb-tabs-design.zh.md`

## 全局约束

- 不添加 Dify 或 `dsh-dify-*` 依赖。
- 不向 Git 添加 token、密码、`/Users/...` 路径、Docker 卷或 MaxKB 用户数据。
- 保留现有 Soho 主 UI；仅改变 MaxKB 工作台区域。
- 支持从相对 checkout 的设置路径运行 macOS 和 Windows。

---

### 任务 1：定义标签工作台的回归约定

**文件：**
- 修改：`packages/extensions/maxkb-panel/tests/panel.spec.mjs`
- 修改：`dsh/tests/test-soho-feature-layout.sh`

- [ ] 添加断言，要求存在 `Files` 和 `MaxKB` 标签，并拒绝固定浮层／关闭控件。
- [ ] 运行 `node --test packages/extensions/maxkb-panel/tests/panel.spec.mjs`，确认针对浮层实现出现预期失败。

### 任务 2：实现由源码维护的标签式 MaxKB 工作台

**文件：**
- 修改：`packages/extensions/maxkb-panel/src/client.js`

- [ ] 用标签工作台替换固定浮层，同时保留受信任 URL 校验与 `maxkb-builder` preset 激活。
- [ ] 重新运行面板测试并确认通过。

### 任务 3：记录可移植用法并验证发行布局

**文件：**
- 修改：`dsh/windows/README.zh-CN.md`
- 修改：`dsh/tests/test-windows-launcher-layout.sh`

- [ ] 说明首次运行的 MaxKB 登录／数据边界以及 `Files | MaxKB` 工作台。
- [ ] 校验源码路径、敏感信息缺失、Dify 排除、设置脚本行为及 Windows 布局测试。
