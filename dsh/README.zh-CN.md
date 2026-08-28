# Soho Harness 本机启动说明

此目录是本 fork 的本机发行层。它让 macOS 与 Windows 使用同一份源码启动
Soho Harness、内置办公技能及可选的本机 MaxKB；不会提交或复制任何个人资料。

## clone 后可获得的功能

- Soho 品牌皮肤；
- 本地附件上传与会话工作区保留；
- 设置 → 技能，以及 `/meeting-proposal`、`/docx`、`/xlsx`、`/pptx`；
- 右侧 `Files | MaxKB` 工作台；
- 可选的本机 MaxKB Docker Compose 服务（默认 `127.0.0.1:8080`）。

`Files` 标签页用于说明附件仍由 DSH 的工作区和输入框“+”管理；选择
“MaxKB 工作流构建”模式或点击 `MaxKB` 标签页，会在同一右侧栏打开本机 MaxKB
管理页。它不会打开通用网页沙箱，也不向页面写入令牌。

## 前置条件

- Node.js 22.x 与 pnpm 11.x；
- Docker Desktop（仅在需要本机 MaxKB 时安装）；
- 可访问项目依赖和 MaxKB 镜像仓库的网络。

先在仓库根目录运行一次：

```bash
node dsh/release/check-environment.mjs
```

该命令只检查 Node、pnpm、Docker、系统和架构，不会改动系统。

## macOS

```bash
pnpm install
docker compose -f dsh/maxkb/docker-compose.yml up -d
bash dsh/setup-soho-web-macos.sh
bash dsh/start-soho-web-macos.sh
```

浏览器访问 `http://127.0.0.1:3080`。如果不需要 MaxKB，可仅执行
`node dsh/setup-soho-web.mjs` 与 `pnpm dsh web`；右侧 MaxKB 标签页会提示服务未启动。

## Windows 10/11

1. 安装 Node.js 22、pnpm 11 和 Docker Desktop（需要 MaxKB 时）。
2. clone 本仓库并在根目录执行 `pnpm install`。
3. 双击 `dsh\\windows\\Start-Soho.cmd`。

启动器把个人运行状态写在当前 Windows 用户目录，不写入 checkout；完整配置说明见
[`windows/README.zh-CN.md`](windows/README.zh-CN.md)。

## 更新源码

```bash
git pull
node dsh/setup-soho-web.mjs
```

Soho 皮肤、MaxKB 工具与右侧工作台在用户本机的 DSH Profile 中以 `link:` 引用当前
checkout；因此不会生成旧版本副本。重启 3080 即可加载更新后的源码。这个用户本机链接
包含本机 checkout 路径，但该路径只保存在 DSH Profile 中，不会进入 Git。

## 数据与密钥边界

代码库**不包含** MaxKB 用户、账号、密码、API Key、Token、工作流、知识库、Docker
卷、浏览器 Cookie、会话、附件和生成文件。每位使用者启动本机 MaxKB 后，需要自行创建
或按受控流程导入应用与数据；若要让 DSH 的 MaxKB 管理工具调用 API，则由使用者在本机
提供 `MAXKB_TOKEN` 或 `MAXKB_ACCOUNT_FILE`。这两项都不得提交到 Git。

内置办公技能采用快速失败策略：会话中不会自动下载 Python/npm/Office/LibreOffice/Docker
依赖。演示前请先在目标电脑试运行一次所需技能；环境缺少运行时会立即提示，而不会在会
议中长时间下载安装。
