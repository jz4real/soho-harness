# Windows Soho 启动器实施计划

[English](2026-08-28-windows-soho-launcher.md) | 中文

> **供 agent 工作者使用：** 必须使用子技能 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项执行本计划。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 发布由源码维护的 Windows 启动器，在不嵌入凭据或 macOS 路径的情况下，于 3080 打开 Soho Harness，并可选地在 8080 启动 MaxKB。

**架构：** 平台中立的设置辅助程序负责生成 profile；轻量 Windows CMD 和 PowerShell 包装器负责前置条件、端口和 Docker 检查。本地配置文件只提供公开端点设置。没有 MaxKB 授权时，启动器不再阻止 DSH UI 启动。

**技术栈：** Node.js 22、pnpm 11、PowerShell、Docker Compose、DSH profile bundles。

**规格：** `docs/superpowers/specs/2026-08-28-windows-soho-launcher-design.zh.md`

## 全局约束

- 不提交凭据、token、账号 JSON、本地 DSH 状态、容器卷、附件或生成的会话。
- 默认端口为 DSH 3080、MaxKB 8080；不包含 Dify。
- 只使用从 checkout 或当前用户 home／应用数据目录派生的路径。
- 保持现有用户 profile 行和数据不变。

---

### 任务 1：由源码维护 Soho 品牌包

**文件：**
- 创建：`packages/extensions/soho-brand/**`
- 修改：`dsh/setup-soho-web.mjs`
- 测试：`dsh/tests/test-soho-web-setup.sh`

**接口：**
- 生成指向 `packages/extensions/soho-brand` 的包依赖 `@soho/dsh-brand-plugin`。

- [ ] 将 MIT 插件源码及其 LICENSE 复制到源码树。
- [ ] 编写失败的设置测试，要求干净 profile manifest 包含从 checkout 派生的 Soho 品牌依赖。
- [ ] 更新设置逻辑，以幂等方式添加由源码维护的包及其 patch 行。
- [ ] 运行设置测试，断言生成输出中没有用户专属路径。

### 任务 2：添加启动器配置与无 token 启动

**文件：**
- 创建：`dsh/config/soho.example.json`
- 修改：`dsh/start-soho-web.mjs`
- 测试：`dsh/tests/test-soho-web-start.sh`

**接口：**
- 使用可选的 `SOHO_CONFIG_FILE`、`MAXKB_BASE_URL`、`DSH_WEB_PORT` 和 `MAXKB_TOKEN`。
- 生成仅在提供 token 时才授权 MaxKB 工具的 DSH 进程。

- [ ] 编写失败测试：在没有 token 材料时针对本地 HTTP fixture 启动器，并期望它调用 DSH 而不是抛错。
- [ ] 解析非敏感端点设置并保持环境变量优先级。
- [ ] 没有 MaxKB 授权时改为警告而非抛错。
- [ ] 分别在有和无 token 时运行启动测试。

### 任务 3：添加 Windows 入口点

**文件：**
- 创建：`dsh/windows/Start-Soho.cmd`
- 创建：`dsh/windows/Start-Soho.ps1`
- 创建：`dsh/windows/README.zh-CN.md`
- 测试：`dsh/tests/test-windows-launcher-layout.sh`

**接口：**
- CMD 入口点使用 checkout 根目录委托给 PowerShell。
- PowerShell 在调用 Node 脚本前校验 `node`、`pnpm`、`docker` 和端口。

- [ ] 为入口点、必需端口变量、非敏感配置路径和 macOS 字面量缺失编写失败布局测试。
- [ ] 添加 CMD shim 和 PowerShell 包装器，使用安全错误信息与本地应用数据默认值。
- [ ] 添加包含前置条件和一键设置步骤的内部 Windows README。
- [ ] 在可用时运行布局测试和静态 PowerShell 语法校验。

### 任务 4：验证全新 home 并记录发行文档

**文件：**
- 修改：`dsh/tests/test-soho-feature-layout.sh`
- 修改：`dsh/tests/test-release-layout.sh`
- 修改：`docs/soho/local-features.zh.md`

**接口：**
- 生成可审计的发行检查，拒绝凭据和外部演示路径。

- [ ] 编写失败测试，拒绝历史外部 Soho/Dify 路径，并验证干净 profile 中范围内功能由源码维护。
- [ ] 更新发行测试和文档，说明本发行版不包含 Dify。
- [ ] 运行所有聚焦测试、扩展 Node 测试、`git diff --check`，并构建本地 Web UI 供人工检查。
