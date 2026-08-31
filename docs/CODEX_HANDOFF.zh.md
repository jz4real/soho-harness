# Soho Harness 项目交接文档

[English](CODEX_HANDOFF.md) | 中文

> 状态基线：`master` 已推送至 `origin/master`。本文件用于新任务重建项目状态；在执行升级、迁移或删除前，仍须重新检查 Git 与服务状态。本文件不包含密码、Token、账号文件或个人绝对路径。

## 1. 目标、范围和产品定位

本项目是 `deepseek-ai/deepseek-harness` 的 Soho 定制 fork，目标是提供可本机部署的办公 Agent 工作台：

- Soho 品牌皮肤和保持现有 DSH 对话/Agent 能力；
- 会话附件本机保存、有限本地解析、可调用 Skills；
- 内置 Word、Excel、PowerPoint 和会议议案等办公演示技能；
- 右侧 `Files | MaxKB` 工作台及本机 MaxKB API 工具；
- macOS 与 Windows 的本机启动方式；MaxKB 是可选 Docker 服务。

当前版本是本机演示/受控部署基础，**不是**云端多租户生产服务。Dify 当前不包含在正式发行层。

## 2. Git 基线和提交状态

| 项目 | 当前值 |
| --- | --- |
| 工作分支 | `master` |
| 自身远程 | `origin` → `https://github.com/jz4real/soho-harness.git` |
| 官方上游 | `upstream` → `https://github.com/deepseek-ai/deepseek-harness.git` |
| 最近工作台提交 | `ef04b5e Improve Soho workbench interaction` |
| 最近 MaxKB 发行提交 | `cc72ba7 Add Soho local MaxKB support` |

写本文档时，本地 `master` 与 `origin/master` 同步。GitHub 当时显示 fork 有 22 个独有提交、落后 upstream 1313 个提交；该数量是动态的，接续任务必须重新核对。

当前定制相关历史还包括附件解析/文件卡片、Skills 库、Skills 导入/调用与 UI 改进。查看真实状态的命令：

```bash
git status --short --branch
git log --oneline -22
git remote -v
```

## 3. 已完成能力与源码位置

### Soho 品牌

- 源码：`packages/extensions/soho-brand/`。
- 由本机 Profile 以 `link:` 指向当前 clone；用户路径只存在本机 Profile，不进入 Git。
- 包含品牌资源和 MIT 许可证，不依赖个人素材绝对路径。

### 附件、工作区与 `/` 调用

- 本地附件宿主：`packages/attachment/attachment-local/`。
- Web 附件控件：`packages/client/ui-attachment/`。
- `/` 输入触发菜单：`packages/client/ui-input-trigger/`。
- 附件原件保留在当前使用者的 DSH 工作区；仅有限文本提取用于已配置模型的任务上下文。输入原件不得被输出覆盖。

### Skills 管理

- 设置页：`packages/client/ui-settings-skills/`。
- 技能库宿主：`packages/host/skill-library/`。
- 内置安装源：`dsh/builtin-skills/`。
- “设置 → 技能”可导入包含 `SKILL.md` 的目录；导入后可输入 `/技能名` 并从建议菜单选择。
- 用户导入的同名 Skill 是显式覆盖；启动器不会覆写用户版本。

### 预装办公 Skills

| 调用 | 目录 | 用途 |
| --- | --- | --- |
| `/meeting-proposal` | `dsh/builtin-skills/meeting-proposal/` | 用随包 Word 模板和用户材料生成正式会议议案。 |
| `/docx` | `dsh/builtin-skills/docx/` | 读取、生成、修改、校验 DOCX。 |
| `/xlsx` | `dsh/builtin-skills/xlsx/` | 读取 CSV/XLSX，生成管理分析工作簿。 |
| `/pptx` | `dsh/builtin-skills/pptx/` | 根据材料创建或修改管理层 PPTX。 |

每个 Skill 都写有 `demo-fast-path: no-auto-install`：只检查一次已有运行时，缺少依赖即明确报错；禁止在会话中 `pip install`、`npm install`、下载 LibreOffice/镜像、搜索镜像或长时间重试。输出后只进行必要的一次结构校验。此约束用于避免历史上因下载 LibreOffice、Python 包或公式引擎造成长时间等待。

### MaxKB 与右侧工作台

| 组件 | 位置 | 作用 |
| --- | --- | --- |
| API 工具 | `packages/extensions/maxkb/` | 健康检查、列出/读取/创建应用、更新工作流、打开原生调试页。 |
| 右侧面板 | `packages/extensions/maxkb-panel/` | `Files | MaxKB` 标签、受信任 iframe、可拖拽分隔线。 |
| 安装器 | `dsh/setup-soho-web.mjs` | 写入本机 Profile 的 `link:` 依赖，注册面板、工具和预设，复制内置 Skills。 |
| 启动器 | `dsh/start-soho-web.mjs` | 检查 MaxKB，传递本机环境变量并启动 DSH Web。 |
| Compose | `dsh/maxkb/docker-compose.yml` | 启动固定 digest 的 MaxKB 和两个命名数据卷。 |

选择“MaxKB 工作流构建”模式或点击右栏 `MaxKB` 标签，才会加载配置的本机 MaxKB `/admin` 页面；常规对话默认显示 `Files`。右栏宽度可拖拽（280px 至较小者：1200px、窗口的 65%）。拖拽期间临时禁用 iframe 指针事件，解决 MaxKB 页面抢占鼠标导致向右拖动困难的问题；松开即恢复。`Files` 页的“打开附件选择器”会调用 DSH 原生附件按钮，不另建文件存储。

iframe 只接受配置的 MaxKB 同源、`/admin` 路径，并使用 `no-referrer`，不会嵌入任意网页。

### Dify

Dify **没有**被包含在当前源码发行层。安装器会清除旧 `dsh-dify-*` 本机 Profile 引用，避免 Dify 与 MaxKB 同时注入右栏。任何 Dify 恢复工作必须先确认来源、许可证、独立服务/端口、认证方式和 UI 集成设计。

## 4. 本机架构、数据与安全边界

```text
Browser (127.0.0.1:3080)
  ├─ DSH Web / Soho branding / sessions / Skills / attachments
  └─ Files | MaxKB workbench
       └─ MaxKB admin page (127.0.0.1:8080, optional Docker)
            └─ applications, workflows, knowledge bases, user data volumes
```

- 附件在本机工作区保存并本机解析；如果使用云端模型，所需文本仍会发往该模型服务。这不是“文件永不离开电脑”的保证。
- Compose 默认仅绑定 loopback `127.0.0.1`，不会自动暴露到局域网。
- 仓库禁止包含 MaxKB 用户、密码、API Key、Token、工作流、知识库、Docker 卷、Cookie、会话、附件或生成文件。
- MaxKB 工具使用本机进程环境的 `MAXKB_TOKEN`，或本机 `MAXKB_ACCOUNT_FILE` 获取授权；工具输出会过滤常见敏感键和值。
- DSH 模型密钥由用户在本机设置页或受控部署环境提供；禁止写入 Git、示例配置、交接文档或截图。
- 禁止提交用户目录、账号 JSON、浏览器 Cookie、DSH Profile 内容、MaxKB volume 或本地环境文件。

## 5. 安装、启动、端口和日常操作

### 前置条件

- Node.js 22.x；pnpm 11.x；
- Docker Desktop（需要本机 MaxKB 时）；
- 可访问依赖和 MaxKB 镜像仓库的网络；
- 如需生成办公文件，演示电脑需事先安装所需 `python-docx`、`openpyxl`、`python-pptx` 或 `pptxgenjs`。

可先运行只读环境检查：

```bash
node dsh/release/check-environment.mjs
```

### macOS / shell 启动

```bash
pnpm install
docker compose -f dsh/maxkb/docker-compose.yml up -d
bash dsh/setup-soho-web-macos.sh
bash dsh/start-soho-web-macos.sh
```

- DSH Web 默认：`http://127.0.0.1:3080`
- MaxKB 默认：`http://127.0.0.1:8080`
- 若 3080 已占用，通常已有 DSH 在运行；不要重复启动，先使用现有实例或明确停止旧进程。
- 若 MaxKB 右栏灰屏/拒绝连接，优先检查：

```bash
docker compose -f dsh/maxkb/docker-compose.yml ps
```

服务未启动时执行 Compose `up -d`；不要使用会删除数据卷的命令。

### Windows 10/11 x64 启动

1. 安装 Node.js 22 LTS、pnpm 11、Docker Desktop；Docker 使用 Linux containers / WSL 2。
2. 在仓库根目录完成一次 `pnpm install`。
3. 双击 `dsh\\windows\\Start-Soho.cmd`。

启动器在当前 Windows 用户应用数据目录生成本机设置，默认启动 3080 和 8080；设置可调整 `dshWebPort`、`maxkbPort`、`startMaxKB`，但不能存放密码、Token、账号文件或附件。详细说明见 `dsh/windows/README.zh-CN.md`。

### 更新本 fork

```bash
git pull --ff-only origin master
node dsh/setup-soho-web.mjs
```

重启 3080 后加载当前源码。Profile 使用 `link:`，不会把旧 Soho 包复制成缓存副本。

### 端口

- DSH 默认 3080；MaxKB 默认 8080，二者不冲突。
- MaxKB 可用 `MAXKB_PORT` 或 Windows 本机设置修改。
- DSH 可用 `DSH_WEB_PORT` 或 Windows 本机设置修改。
- 未来 Dify 必须拥有独立服务与端口，不得复用 8080 或现有 MaxKB 面板。

## 6. MaxKB 数据、权限与迁移

Compose 中固定了 MaxKB 镜像 digest，并使用应用数据卷和 PostgreSQL 数据卷。镜像可复现，**不代表**自动包含同事环境的应用、工作流、知识库、模型配置、用户或权限。

要获得既有 MaxKB 的完整能力，必须由对应环境管理员提供受控导出/导入材料，或按受控流程迁移数据卷和授权配置。单纯登录新部署的空白 MaxKB 不能自动拥有他人的资产。

跨机器迁移时先停止两端容器，先预览：

```bash
node dsh/release/migrate-maxkb-volumes.mjs \
  --source-data SOURCE_DATA --source-postgres SOURCE_POSTGRES \
  --target-data TARGET_DATA --target-postgres TARGET_POSTGRES
```

完成目标、备份和敏感信息检查后才追加 `--apply`。绝不复制正在运行的卷，绝不把卷提交入 Git。

## 7. 已执行验证

最近提交前已通过：

```bash
node --test packages/extensions/maxkb/tests/maxkb.spec.mjs packages/extensions/maxkb-panel/tests/panel.spec.mjs
bash dsh/tests/test-release-layout.sh
bash dsh/tests/test-soho-web-setup.sh
bash dsh/tests/test-soho-feature-layout.sh
bash dsh/tests/test-windows-launcher-layout.sh
pnpm run build:lib:host
pnpm run typecheck:contracts-ready
git diff --check
```

人工验证过：Soho 皮肤加载；`Files | MaxKB` 标签可切换；附件选择器可唤起；MaxKB iframe 打开后仍可向左和向右拖动；本机 MaxKB 可由 Compose 启动且健康检查可连通；MaxKB 工具可读取工作流；内置办公 Skill 的快速失败规则已写入各 `SKILL.md`。

## 8. 已知限制与演示前检查

1. 办公生成依赖预装运行时；Skill 不会替用户安装。演示前在目标电脑试跑每个要展示的 Skill。
2. MaxKB 管理页需要服务可达且完成合法登录；API 工具另需本机授权。
3. 未配置 `MAXKB_TOKEN` 或 `MAXKB_ACCOUNT_FILE` 时，右栏可登录浏览，但管理工具不能携带授权操作。
4. 使用云端模型时，附件的相关文本会按模型服务规则离开本机。
5. 上游差异很大，未完成隔离升级和全量回归前不得在稳定版同步 fork。
6. Dify 不是本次 clone 后即用能力。

最小演示前检查：

```bash
git status --short --branch
docker compose -f dsh/maxkb/docker-compose.yml ps
node dsh/release/check-environment.mjs
```

再打开 3080，上传非敏感样例文件，调用一个办公 Skill，并选择 MaxKB 模式确认右栏加载。

## 9. 上游升级流程

不要在 `master` 直接点 GitHub 的 Sync fork。标准流程：

```bash
git switch master
git pull --ff-only origin master
git status
git branch backup/master-before-upstream-YYYY-MM-DD
git switch -c upgrade/upstream-YYYY-MM-DD
git fetch upstream --prune
git merge --no-ff upstream/master -m "Merge upstream updates YYYY-MM-DD"
```

如冲突，`git status` 会列出文件；在编辑器中理解双方意图，消除 `<<<<<<<`、`=======`、`>>>>>>>`，逐个 `git add <file>`，再 `git merge --continue` 或 `git commit`。重点人工审查 DSH UI、插件装载、构建配置、锁文件与 Soho 扩展。任何时刻可安全撤销：

```bash
git merge --abort
git switch master
```

升级分支必须跑第 7 节全部验证和人工回归，随后：

```bash
git push -u origin upgrade/upstream-YYYY-MM-DD
```

通过 Pull Request 合并至 `master`。不要对共享 `master` rebase 或 force push。

## 10. 下一步与新任务接续规则

后续优先事项：Windows 真机端到端验收；受控预装办公运行时；与 MaxKB 管理员确认资产导入、账号/权限、模型密钥、备份；再决定云端多用户的身份、文件/会话隔离、沙箱、审计、并发和运维设计。

新 Codex 任务必须先阅读本文件、`dsh/README.zh-CN.md`、`docs/soho/local-features.md`、`dsh/maxkb/docker-compose.yml` 和有关扩展目录，然后执行：

```bash
git status --short --branch
git log --oneline -12
git remote -v
```

在用户明确确认前：不修改代码、不提交、不停止 Docker 服务、不删除任何数据卷。
