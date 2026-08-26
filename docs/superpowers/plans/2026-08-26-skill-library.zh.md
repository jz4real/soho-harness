# 技能库实施计划

[English](2026-08-26-skill-library.md) | 中文

> **供 agent 工作者使用：** 必须使用子技能 `superpowers:executing-plans`，逐项执行本计划。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 增加 Web Settings 技能库，用于导入、管理、展示和斜杠调用本地 DSH 技能，且不改动插件清单。

**架构：** host `skill-library` Remote 服务拥有安全的文件系统导入与用户根目录状态。browser `ui-settings-skills` 包贡献独立的 Settings 设置项并调用该服务。现有 `ui-skill` 来源仍是唯一的 `/name` 调用路径。

**技术栈：** TypeScript、Cordis、Typert Remote services、React、CSS modules、Vitest、Playwright。

**规格：** [../specs/2026-08-26-skill-library-design.zh.md](../specs/2026-08-26-skill-library-design.zh.md)

## 全局约束

- 仅在 `${DSH_HOME:-~/.dsh}/skills` 下安装托管用户技能。
- 将停用的 bundle 保留在 `${DSH_HOME:-~/.dsh}/skills-disabled`；绝不通过编辑其 `SKILL.md` 表示停用状态。
- 将 bundled/runtime 技能视为只读，不得把它们描述为在线广场。
- 拒绝格式错误、路径穿越、符号链接逃逸、重复或非 kebab-case 的导入。
- 保留现有“插件”Settings 设置项，并使用现有 `/name` 菜单调用。

---

### 任务 1：定义 host skill-library 契约

**文件：** 新建 `packages/host/skill-library/{package.json,tsconfig.json,tsdown.config.ts,src/types.ts,src/index.ts,src/invariant.ts,tests/invariant.spec.ts,tests/skill-library.spec.ts}`；修改 `packages/api/remotes/{package.json,tsconfig.client.json,src/client/index.ts}`。

**接口：** `SkillLibraryGateway` 暴露 `list()`、`inspect(name)`、`importFolder(path, mode)`、`importArchive(bytes, mode)`、`setEnabled(name, enabled)` 与 `remove(name)`。列表条目携带 `name`、`description`、`source`、`status`、`path`、`resourceCount`、`executablePaths` 和调用策略。

- [ ] 为空列表、用户/内置来源区分以及生成的 Typert Remote client face 编写失败的 host 测试。
- [ ] 只实现这些测试所需的类型、Remote decorators 及只读 `list/inspect` 投影。
- [ ] 运行 `pnpm vitest packages/host/skill-library/tests/skill-library.spec.ts`，并提交 `feat: add skill library catalog`。

### 任务 2：实现安全的文件夹安装

**文件：** 修改 `packages/host/skill-library/src/index.ts`；在 `tests/skill-library.spec.ts` 覆盖该流程。

**接口：** `validateBundle(root)` 返回已解析候选或带类型的拒绝。`installFolder(candidate, mode)` 在临时同级目录暂存工作，再原子重命名到 `~/.dsh/skills/<name>`。

- [ ] 为有效 `SKILL.md`、格式错误 YAML、无效名称、嵌套 bundle、符号链接、冲突拒绝、显式替换以及注入的重命名失败回滚编写失败测试。
- [ ] 实现安全的文件夹遍历；只接受包含 `SKILL.md` 的一个 bundle 目录，拒绝所有符号链接，并在暂存副本后原子重命名。
- [ ] 运行 `pnpm vitest packages/host/skill-library/tests/skill-library.spec.ts`，并提交 `feat: import validated skill bundles`。

### 任务 3：实现启用、停用和删除

**文件：** 修改 `packages/host/skill-library/src/index.ts`；在 `tests/skill-library.spec.ts` 覆盖生命周期。

**接口：** `setEnabled(name, false)` 将一个托管 bundle 移到 `skills-disabled`；`setEnabled(name, true)` 反向移动；`remove(name)` 只删除托管用户或停用 bundle。

- [ ] 编写失败测试，断言停用 bundle 离开发现根目录、在重启形态的新 gateway 中保留，且不能修改内置条目。
- [ ] 实现原子移动、陈旧目标拒绝和带类型的只读失败。
- [ ] 运行 `pnpm vitest packages/host/skill-library/tests/skill-library.spec.ts`，并提交 `feat: manage local skill lifecycle`。

### 任务 4：构建 Settings Skills 设置项

**文件：** 新建 `packages/client/ui-settings-skills/{package.json,tsconfig.json,tsdown.config.ts,src/client/index.ts,src/client/SkillsSettingsSection.tsx,src/client/SkillLibraryTab.tsx,src/client/ImportSkillDialog.tsx,src/client/*.module.css,src/client/locales.ts,src/invariant.ts,tests/*.spec.tsx}`；修改 `packages/bundle/web-app/{package.json,cordis.patch.yml}`。

**接口：** client 注入 id 为 `skills` 的 `settings.section`；它消费 `remote.skillLibrary`，不暴露任何“插件”Settings 标签页。`ImportSkillDialog` 接受 host 选择的目录，并在冲突预览后要求显式替换操作。

- [ ] 为导航顺序、“我的技能/内置技能”标签页、加载/错误/空状态、搜索、只读内置卡片和成功导入后的焦点编写浏览器组件测试。
- [ ] 实现本地化 Settings 设置项、卡片、详情、启用/停用/删除控件和导入预览；保留已有插件清单标签页使用的无障碍标签与键盘行为。
- [ ] 运行 `pnpm vitest packages/client/ui-settings-skills/tests`，并提交 `feat: add skills settings surface`。

### 任务 5：连接桌面导入和 Profile 组合

**文件：** 修改 `packages/bundle/web-app/{package.json,cordis.patch.yml}` 与任务 1 中的 Remote 聚合文件；在 `packages/host/skill-library/tests` 和 `apps/web/tests` 下新建或扩展聚焦的 API 与 Web E2E 测试。

**接口：** 文件夹导入使用现有原生目录选择器和 host `importFolder` Remote。

- [ ] 编写失败 E2E 覆盖：导入 `meeting-proposal`、在“我的技能”看到它、停用它、验证它离开 `/` 候选、重新启用它并验证它返回。
- [ ] 在依赖就绪后将 host 和 browser 包条目加入 Web bundle；将导入控件连接到已命名的 Remote 方法。
- [ ] 运行 `pnpm vitest apps/web/tests/skill-library.e2e.ts`，并提交 `feat: wire skill library into web profile`。

### 任务 6：验证真实 Soho Profile 和文档

**文件：** 如果公开包行为需要，则修改配对的包 README；使用 `verify-translation-pairing --write` 更新配对的设计与计划记录。

- [ ] 启动本地 Web Profile，打开“设置 → 技能”，导入现有 `meeting-proposal` bundle，并验证其源模板保持字节完全一致。
- [ ] 在新会话输入 `/meeting-proposal`，选择自动补全候选并提交一条起草请求。
- [ ] 运行 `pnpm run lint`、`pnpm run doc-sync`、聚焦 host/client/E2E 测试和 `git diff --check`；以 `docs: document skill library` 单独提交文档。
