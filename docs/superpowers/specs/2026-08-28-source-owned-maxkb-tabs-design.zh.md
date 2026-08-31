# 源码维护的 MaxKB 标签页设计

[English](2026-08-28-source-owned-maxkb-tabs-design.md) | 中文

## 目标

保留现有 Soho Harness 主 UI，并将 MaxKB 放置在既有右侧 `Files | MaxKB` 工作台中，而非打开独立固定浮层。

## 范围

- 由源码维护的轻量右侧工作台提供 `Files` 标签和 `MaxKB` 标签。
- 选择 `maxkb-builder` preset 会激活 MaxKB 标签，并且只在 iframe 中加载受信任的本地 MaxKB URL。
- 工作台绝不把密码、token、会话数据或用户文件发送到 Git 或远程端点。
- Dify 和此前外部的 `dsh-dify-*` 包不在范围内。
- 源码设置脚本只从 checkout 安装由源码维护的包，且不包含用户专属绝对路径。

## 非目标

- 随发行版提供 MaxKB 账号、模型密钥、既有应用、工作流、知识库、Docker 卷或浏览器登录会话。
- 复刻 Dify 功能。
- 修改左侧导航、Soho 主题、对话布局、附件 UI 或 Skills UI。

## 设计

`@soho/dsh-maxkb-panel` 仍是唯一 client 包。它把右锚定工作台作为稳定布局区域挂载，并提供紧凑标签栏。`Files` 标签提供中性的本地文件占位区，`MaxKB` 标签承载现有受信任 iframe。它只在选择 `maxkb-builder` 时打开，选择其他 preset 时隐藏。这样既保留现有视觉结构，也无需依赖重量级外部 Dify 侧边栏包。

iframe 目标必须匹配配置的 MaxKB origin，且路径以 `/admin` 开头。基础 URL 默认为 `http://127.0.0.1:8080`，启动配置可通过本地环境／配置覆盖。此 UI 不会渲染或持久化 token。

## 分发与文档

源码设置脚本继续使用相对 checkout 的文件依赖来注册面板和 MaxKB 工具。Windows README 说明首次运行的前置条件、端口、本地数据边界，以及启动后必须创建或导入 MaxKB 账号／工作流。自动化布局测试会断言不存在 Dify 包依赖、用户绝对路径或 token 字面量，并验证标签工作台行为。
