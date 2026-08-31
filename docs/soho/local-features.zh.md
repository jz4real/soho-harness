# Soho Harness 本地功能

[English](local-features.md) | 中文

此 fork 将以下功能作为版本化源码提供：

- **本地文件附件：** `packages/attachment/attachment-local` 会把原始文件存放在所选 DSH home 下，提取有界的本地文本，并且只把该文本提供给已配置的模型服务。Web 控件位于 `packages/client/ui-attachment`。
- **技能设置：** `packages/host/skill-library` 管理导入的技能目录，`packages/client/ui-settings-skills` 增加“设置 → 技能”界面。导入的技能仍通过现有 `/skill-name` 对话流程调用。

**MaxKB 集成**由本 fork 的源码维护：host 工具、`Files | MaxKB` 右侧工作台、Agent preset 安装器、可移植启动器和 Compose 资源均位于 `packages/extensions/maxkb*` 与 `dsh/`。工作台是布局区域而非弹窗；其 iframe 只接受已配置的本地 MaxKB `/admin` 来源。

**Soho 品牌**由 `packages/extensions/soho-brand` 的源码维护，并由设置辅助程序安装到干净 profile。它使用 MIT 许可证，且不依赖任何用户专属的资源路径。

**内置办公技能**由 `dsh/builtin-skills` 的源码维护：干净 profile 会收到 `/meeting-proposal`、`/docx`、`/xlsx` 和 `/pptx`。这些技能采用快速失败预检策略：对话期间不允许自动下载或安装 Python、npm、Office 或 Docker 依赖。同名导入技能保留为用户的显式覆盖。

**当前发行版不包含 Dify。** 设置辅助程序会先移除旧 `dsh-dify-*` profile 引用，再注册由源码维护的包，因此干净 clone 不会意外启动两个冲突的右侧布局。Dify 使用独立服务，在其来源和许可证获准前将继续排除在外。

在 Windows 上使用 `dsh/windows/Start-Soho.cmd`。它会准备本地 DSH home，在 Docker 可用时于 8080 启动 MaxKB，并在 3080 打开 DSH。启动器可在没有 MaxKB 授权时运行，但管理工具会保持不可用，直到操作人员提供本地 token 或账号文件。

不得把服务凭据、MaxKB API token、对话日志、附件或生成物提交到 Git。Web 启动器只会在操作人员启动时显式提供的情况下，从其本机 MaxKB 安装中读取短期 token。
