# Soho Harness Windows 启动包

此目录提供 Windows 10/11 x64 的本机网页启动入口。它不复制其他电脑的
账号、模型密钥、会话、附件或 MaxKB 数据。

## 第一次启动前

1. 安装 Node.js 22 LTS；
2. 打开 PowerShell，执行 `corepack enable`，然后执行
   `corepack prepare pnpm@11.7.0 --activate`；
3. 安装并启动 Docker Desktop，确认使用 Linux containers；
4. 从本仓库根目录双击 `dsh\\windows\\Start-Soho.cmd`。

首次启动会安装本机依赖、拉取 MaxKB 镜像，并在浏览器打开
`http://127.0.0.1:3080`。MaxKB 默认使用 `http://127.0.0.1:8080`。
随后启动器会离线安装本机 Profile 中的 Soho 皮肤、MaxKB 面板和内置技能配置；
这一步不会下载 Python、Office、LibreOffice 或技能运行时。
这几个本地源码包通过 Profile 的 `link:` 直接指向当前 clone；Git 更新后的皮肤和工作台
不会落入旧缓存，也不会写入仓库或下载新的技能依赖。

## 右侧工作台

网页右侧始终提供 `Files | MaxKB` 工作台。`Files` 说明当前会话附件的本地工作区位置；
选择“MaxKB 工作流构建”模式或点击 `MaxKB` 标签页后，才会在同一右侧栏加载本机
MaxKB 管理页面。它不是弹窗，也不会把 MaxKB 账号、Cookie、工作流、知识库或模型密钥
写入本仓库。

## 预装办公技能与演示速度

全新安装会预装 `/meeting-proposal`、`/docx`、`/xlsx`、`/pptx`。这些技能采用
**演示快速路径**：只检查一次已存在的运行时；缺少时立刻说明缺什么并停止，绝不在
会话中自动执行 `pip install`、`npm install`、下载 LibreOffice、拉取 Docker 镜像或
长时间重试。用户后来导入同名技能时，启动器保留用户版本，不会覆盖。

如需当场生成 DOCX/XLSX/PPTX，请由管理员在演示前一次性准备相应运行时；例如
`python-docx`、`openpyxl`、`python-pptx` 或 `pptxgenjs`。这属于部署准备，不属于
一次会话内的隐藏安装步骤。

## 本机设置

首次运行会创建 `%LOCALAPPDATA%\\SohoHarness\\config.json`。可在其中调整
`dshWebPort`、`maxkbPort` 和 `startMaxKB`。不要把密码、API Key、Token、账号
JSON 或附件放进该文件，更不要提交该文件到 Git。

DSH 模型密钥通过设置页录入。MaxKB 管理工具需要由使用者本机提供
`MAXKB_TOKEN` 或 `MAXKB_ACCOUNT_FILE`；未提供时 DSH 仍会打开，右侧 MaxKB
页可用于登录，但管理工具不会携带授权。

## Dify

本启动包不包含 Dify，也会移除旧 Profile 中遗留的 `dsh-dify-*` 本地包引用，避免
新旧右侧栏同时加载。Dify 使用独立服务和端口，待其来源与许可证确认后另行提供，
不影响 MaxKB 的 8080 端口。
