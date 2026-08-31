# Windows Soho 启动器设计

[English](2026-08-28-windows-soho-launcher-design.md) | 中文

## 目标

提供内部 Windows 启动包，用于准备并启动源码 checkout，使其成为本地 Soho Harness Web 应用，而不复制另一台机器的 macOS 依赖、凭据、DSH 状态或 MaxKB 数据。

## 范围

- 将采用 MIT 许可证的 Soho 品牌插件作为由源码维护的本地包纳入。
- 默认在 `127.0.0.1:3080` 启动 DSH，在 `127.0.0.1:8080` 启动 MaxKB。
- 本发行版排除 Dify；它仍是可选且需单独配置的集成。
- 创建 Windows `.cmd` 和 PowerShell 入口点，以及可移植的 Node 设置辅助程序。辅助程序只准备用户本地的 DSH home。
- 保留现有 MaxKB 和 DSH 数据。绝不从仓库植入账号、token、模型密钥、会话、附件或卷。

## 非目标

- 原生签名 `.exe`，或捆绑 Docker Desktop、Node.js、pnpm 或模型提供方账号。
- 导出当前 Mac 的 MaxKB 数据或凭据。
- 启用 Dify；它尚未有确认的源码和再分发许可证。

## 架构

`Start-Soho.cmd` 调用 `Start-Soho.ps1`。PowerShell 包装器校验 Windows 前置条件和主机端口可用性，运行 Node 设置辅助程序，并在 Docker 可用时启动 MaxKB Compose。随后它通过每用户 `DSH_HOME` 启动平台中立的 Node Web 启动器。

设置辅助程序把由源码维护的品牌和 MaxKB 包路径写入用户 profile。它从用户本地 JSON 文件读取可选的非敏感端点配置。凭据只会在启动时通过环境变量或 DSH 凭据设置提供。

## 配置与隐私

公开示例配置只包含主机、端口和 profile 名称。真实配置位于仓库外的用户本地应用数据目录。它不得包含密码、API key、MaxKB token、账号 JSON、附件、会话数据或其他电脑的绝对路径。

`MAXKB_TOKEN` 和 `MAXKB_ACCOUNT_FILE` 仍是可选的启动时输入。没有它们时，Web UI 仍会启动，MaxKB 面板可以显示本地登录页，但服务端 MaxKB 管理工具会保持不可用，直到操作人员提供授权。

## 兼容性

目标环境为使用 Linux-container 模式 Docker Desktop、Node 22、pnpm 11，并可访问配置容器仓库的 Windows 10/11 x64。MaxKB 的固定镜像发布 Linux amd64 和 arm64 变体。Windows 验证必须在真实 Windows 机器上完成；macOS 可校验生成文件，但不能证明 Windows 启动器执行路径。

## 验收标准

1. 全新 checkout 对 Soho 插件或 MaxKB 集成不依赖 `/Users`、`.dsh` 或本地演示目录。
2. Windows 入口点把全部状态写入用户本地应用数据，校验前置条件，并清楚报告被占用的端口。
3. 即使没有提供 MaxKB 凭据，DSH 也会在 3080 端口启动。
4. profile 包含从 checkout 引用的 Soho 品牌和 MaxKB 包。
5. 测试断言生成脚本、包引用、隐私规则和无 token 启动路径。
