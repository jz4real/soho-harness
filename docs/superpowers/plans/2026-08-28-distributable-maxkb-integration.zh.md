# 可分发 MaxKB 集成实施计划

[English](2026-08-28-distributable-maxkb-integration.md) | 中文

> **供 agent 工作者使用：** 必须使用子技能 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项执行本计划。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 将本地 MaxKB 集成变为 Soho Harness fork 的版本化功能，可从常规 3080 Web profile 使用，而无需编辑已安装包或依赖 macOS 专属路径。

**架构：** 添加两个本地扩展包：一个 host 工具包，用于规范化 MaxKB 调试会话响应；一个 client 面板包，用于为显式配置的 MaxKB origin 渲染专用受信任 iframe。保持通用浏览器沙箱不变。新增 MaxKB builder preset；只有该 preset 的会话打开工作台。添加平台中立的设置／启动脚本、Docker Compose 参考、先 dry-run 的卷迁移辅助程序和兼容性矩阵。

**技术栈：** Node.js ESM、Cordis plugin packages、DSH Web profile、pnpm、Docker Compose、shell 集成测试、MaxKB HTTP API。

**规格：** `docs/superpowers/specs/2026-08-26-local-file-attachments-design.md` 和 `docs/superpowers/specs/2026-08-26-skill-library-design.md`。

## 全局约束

- 不得提交 MaxKB 账号、token 或生成的会话数据。
- 3080 profile 为 `${DSH_HOME:-~/.dsh}`，并必须保留其中已安装的 Soho 和 Dify 集成。
- 面板只接受显式 HTTP(S) `baseUrl`；演示配置使用 `http://127.0.0.1:8080`。
- 本工作不削弱通用 Dify 浏览器侧边栏及其沙箱策略。
- MaxKB 面板只在当前会话 preset 为 `maxkb-builder` 时打开。
- 启动行为仅使用环境／配置输入；源码中不得出现 `/Users/...` 路径或账号数据。
- 已提交到 `master` 的附件接收和 skill-library 代码保持不变，仅更新验证／文档。

---

### 任务 1：验证并记录既有的可分发功能

**文件：**
- 创建：`docs/soho/local-features.md`
- 测试：`dsh/tests/test-soho-feature-layout.sh`

**接口：**
- 使用：`packages/attachment/attachment-local`、`packages/client/ui-attachment`、`packages/host/skill-library`、`packages/client/ui-settings-skills`。
- 生成：附件与 skill-library 包的版本化功能图和自动布局检查。

- [ ] **第 1 步：编写失败的布局检查**

```bash
test -f packages/attachment/attachment-local/src/index.ts
test -f packages/client/ui-attachment/src/client/ComposerAttachments.tsx
test -f packages/host/skill-library/src/index.ts
test -f packages/client/ui-settings-skills/src/client/SkillsSettingsSection.tsx
test -f docs/soho/local-features.md
```

- [ ] **第 2 步：运行检查，确认它因缺少功能图而失败**

运行：`bash dsh/tests/test-soho-feature-layout.sh`

- [ ] **第 3 步：编写功能图**

记录附件和导入技能是已提交的源码功能，而 Dify 包目前是 profile 本地工件；安装器将从声明的本地来源供应它们，而不是依赖未跟踪的 profile 修改。

- [ ] **第 4 步：运行检查并确认通过**

运行：`bash dsh/tests/test-soho-feature-layout.sh`

### 任务 2：创建由源码维护的 MaxKB host 插件

**文件：**
- 创建：`packages/extensions/maxkb/package.json`
- 创建：`packages/extensions/maxkb/src/index.js`
- 创建：`packages/extensions/maxkb/src/maxkb-client.js`
- 创建：`packages/extensions/maxkb/tests/maxkb.spec.mjs`

**接口：**
- 使用：`baseUrl`、`token` 或 `tokenEnv`，以及 MaxKB `GET /workspace/:workspaceId/application/:applicationId/open` 端点。
- 生成：`maxkb_open_debug` 结果 `{ ok, debugSessionId, workspaceId, applicationId, workflowUrl }`；绝不返回原始值。

- [ ] **第 1 步：为原始 open 响应编写失败测试**

```js
const result = await openDebugResult({ openDebug: async () => 'debug-session-1' }, {
  workspaceId: 'default', applicationId: 'app-1', baseUrl: 'http://127.0.0.1:8080',
})
assert.deepEqual(result, {
  ok: true, debugSessionId: 'debug-session-1', workspaceId: 'default', applicationId: 'app-1',
  workflowUrl: 'http://127.0.0.1:8080/admin/application/workspace/app-1/workflow',
})
```

- [ ] **第 2 步：运行测试，确认因缺少 `openDebugResult` 而失败**

运行：`node --test packages/extensions/maxkb/tests/maxkb.spec.mjs`

- [ ] **第 3 步：实现最小规范化器和工具注册**

每条工具路径都返回 JSON 对象，包括错误。系统提示明确告知 agent，`maxkb_open_debug` 已打开配置的本地面板；成功时不得再检索源码解释结果。

- [ ] **第 4 步：运行测试并确认通过**

运行：`node --test packages/extensions/maxkb/tests/maxkb.spec.mjs`

### 任务 3：创建专用受信任 MaxKB client 面板

**文件：**
- 创建：`packages/extensions/maxkb-panel/package.json`
- 创建：`packages/extensions/maxkb-panel/cordis.patch.yml`
- 创建：`packages/extensions/maxkb-panel/src/index.js`
- 创建：`packages/extensions/maxkb-panel/src/client.js`
- 创建：`packages/extensions/maxkb-panel/tests/panel.spec.mjs`

**接口：**
- 使用：`maxkbState` 投影（`baseUrl`、`workspaceId`、`applicationId`）和远程事件 `maxkb:open`。
- 生成：一个 `maxkb` 类型侧边栏标签，其组件是仅限配置 MaxKB URL 的普通 iframe；事件导航更新 iframe URL 并激活标签。

- [ ] **第 1 步：编写失败的 client 源码测试**

```js
assert.match(clientSource, /id:\s*['\"]maxkb['\"]/)
assert.match(clientSource, /iframe/)
assert.doesNotMatch(clientSource, /type:\s*['\"]browser['\"]/)
```

- [ ] **第 2 步：运行测试，确认因包不存在而失败**

运行：`node --test packages/extensions/maxkb-panel/tests/panel.spec.mjs`

- [ ] **第 3 步：实现标签描述符和事件路由**

使用 `ctx.betterSidebar.registerTab` 注册自定义 MaxKB 标签。组件使用确切配置 URL，不暴露通用地址字段，且不使用通用浏览器沙箱。URL guard 只接受配置的 `baseUrl` 加 `/admin` 路径。

- [ ] **第 4 步：运行测试并确认通过**

运行：`node --test packages/extensions/maxkb-panel/tests/panel.spec.mjs`

### 任务 4：将全部集成可复现地安装到 3080 Web profile

**文件：**
- 创建：`dsh/setup-soho-web-macos.sh`
- 创建：`dsh/start-soho-web-macos.sh`
- 创建：`dsh/tests/test-soho-web-setup.sh`
- 修改：`docs/soho/local-features.md`

**接口：**
- 使用：fork checkout 路径、`DSH_HOME`、本地提供的 Dify/Soho 包路径，以及来自 `get-maxkb-poc-token.py` 的 `MAXKB_TOKEN`。
- 生成：包含 Soho、Dify、`@soho/dsh-maxkb` 和 `@soho/dsh-maxkb-panel` 的 Web profile 包 manifest，以及加载所有必要 bundle 的 Cordis patch。

- [ ] **第 1 步：编写失败的临时 home 安装器测试**

```bash
DSH_HOME="$tmp/home" DSH_PROFILE=web bash dsh/setup-soho-web-macos.sh
node -e 'const p=require(process.argv[1]); if (!p.dependencies["@soho/dsh-maxkb"]) process.exit(1)' "$tmp/home/profiles/web/package.json"
rg -q '@soho/dsh-maxkb-panel' "$tmp/home/profiles/web/cordis.patch.yml"
```

- [ ] **第 2 步：运行测试，确认因安装器不存在而失败**

运行：`bash dsh/tests/test-soho-web-setup.sh`

- [ ] **第 3 步：实现幂等合并行为**

只更新 Soho 发行层拥有的包依赖和 loader 条目。保留无关 profile 依赖及既有用户 patch 条目。绝不持久化 token；启动器在运行时获取临时 token，并且只为 DSH 进程导出它。

- [ ] **第 4 步：运行测试并确认通过**

运行：`bash dsh/tests/test-soho-web-setup.sh`

### 任务 5：任何提交前在 3080 本地验证

**文件：**
- 修改：`docs/soho/local-features.md`

**接口：**
- 使用：位于 `http://127.0.0.1:8080` 的 MaxKB、配置的 Web profile 和生成的启动脚本。
- 生成：3080 上附件、技能设置、Dify 集成和 MaxKB 面板／工具约定的验证证据。

- [ ] **第 1 步：运行聚焦自动化测试**

运行：`node --test packages/extensions/maxkb/tests/maxkb.spec.mjs packages/extensions/maxkb-panel/tests/panel.spec.mjs && bash dsh/tests/test-soho-feature-layout.sh && bash dsh/tests/test-soho-web-setup.sh`

- [ ] **第 2 步：通过启动器在 3080 启动 Web profile**

运行：`bash dsh/start-soho-web-macos.sh`

- [ ] **第 3 步：验证 HTTP 和可见前端状态**

检查 `curl -fsS http://127.0.0.1:3080/` 成功，并在打开 MaxKB builder 会话后人工检查页面。确认右侧面板是活动 MaxKB 页面，而不是通用沙箱浏览器页。

- [ ] **第 4 步：提交前停止并把本地前端交给用户**

在用户查看并批准 3080 结果前不创建 Git 提交。

### 任务 6：添加可移植发行边界

**文件：**
- 创建：`dsh/setup-soho-web.mjs`
- 创建：`dsh/start-soho-web.mjs`
- 创建：`dsh/get-maxkb-token.mjs`
- 创建：`dsh/maxkb/docker-compose.yml`
- 创建：`dsh/release/check-environment.mjs`
- 创建：`dsh/release/migrate-maxkb-volumes.mjs`
- 创建：`dsh/release/compatibility.md`
- 测试：`dsh/tests/test-release-layout.sh`

**接口：**
- 使用：`DSH_HOME`、`DSH_PROFILE`、`MAXKB_BASE_URL`、`MAXKB_TOKEN` 或 `MAXKB_ACCOUNT_FILE`，以及 Docker 命名卷。
- 生成：profile 安装器、绝不持久化 token 的启动命令和明确、先 dry-run 的数据卷迁移约定。

- [ ] **第 1 步：添加布局断言并运行 red**
- [ ] **第 2 步：实现基于 Node 的设置／启动及 Compose 资源**
- [ ] **第 3 步：实现环境报告和受保护的卷复制命令**
- [ ] **第 4 步：运行 `bash dsh/tests/test-release-layout.sh` 并确认通过**
