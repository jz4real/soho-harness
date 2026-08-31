# 本地文件附件实施计划

[English](2026-08-26-local-file-attachments.md) | 中文

> **供 agent 工作者使用：** 必须使用子技能 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项执行本计划。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 为 Web composer 构建本地优先的通用文件附件，具备持久存储、本地提取、模型上下文和 A 风格文件卡片。

**架构：** 在既有附件 seam 和本地存储中增加并行通用文件路径。在 API 边界接收浏览器文件 wire part，持久化一个 `file` 内容块和一个有界提取文本块，再通过既有对话附件 slot 渲染草稿与历史卡片。提供方适配器忽略持久文件块，消费紧随其后的提取文本。

**技术栈：** TypeScript、React、Vitest、Zod、Node filesystem/crypto、JSZip、PDF.js。

**规格：** `docs/superpowers/specs/2026-08-26-local-file-attachments-design.zh.md`

## 全局约束

- 将原始文件保留在 `DSH_HOME/attachments/v2/files` 下；绝不持久化浏览器路径。
- 接受 CSV、XLSX、DOCX、PDF、TXT、Markdown、JSON 和现有图片类型。
- 单个通用文件上限 20 MiB，一条消息最多 10 个文件／50 MiB；单个提取文件上限 60,000 代码点，一条消息上限 160,000 代码点。
- 本地提取独立于模型；原始 office/PDF 字节绝不进入提供方请求。
- 遵循 TDD：每个生产改动先以一个针对缺失行为的失败测试开始。

---

### 任务 1：通用附件词汇与本地存储

**文件：**
- 修改：`packages/attachment/attachment/src/types.ts`
- 修改：`packages/attachment/attachment/src/index.ts`
- 修改：`packages/attachment/attachment-local/src/index.ts`
- 修改：`packages/attachment/attachment-local/src/store.ts`
- 创建：`packages/attachment/attachment-local/src/file-extract.ts`
- 测试：`packages/attachment/attachment-local/tests/file-extract.spec.ts`
- 测试：`packages/attachment/attachment-local/tests/store.spec.ts`

**接口：**
- 生成 `FileAttachmentRef`、`SaveFileAttachment`、`StoredFileAttachment` 和 `AttachmentStore.saveFiles/readFile`。
- 生成 `extractFileText(input): Promise<{ text: string; truncated: boolean; status: 'ready' | 'unavailable' }>`。

- [ ] 为 CSV 和 UTF-8 文本提取、DOCX/XLSX ZIP XML 提取、PDF 提取、截断、损坏 office 回退以及内容寻址的保存／读取完整性编写测试。
- [ ] 运行两个测试文件，确认它们因通用文件词汇／提取器不存在而失败。
- [ ] 添加最小通用文件词汇、私有内容寻址本地持久化、安全文件名规范化、类型／限额校验和有界提取实现。
- [ ] 运行两个测试文件并确认通过。
- [ ] 使用 `git commit -m "Store local files"` 提交。

### 任务 2：会话提示接收与提供方安全上下文

**文件：**
- 修改：`packages/llm/llm/src/types.ts`
- 修改：`packages/host/apiproxy/src/api/sessions.ts`
- 修改：`packages/host/apiproxy/src/api/sessions.schema.ts`
- 修改：`packages/host/apiproxy/src/api-proxy.ts`
- 修改：`packages/llm/llm-deepseek/src/serialize.ts`
- 修改：`packages/llm/llm-pi-ai/src/context.ts`
- 测试：`packages/host/apiproxy/tests/api-proxy-attachments.spec.ts`
- 测试：`packages/llm/llm-deepseek/tests/serialize.spec.ts`
- 测试：`packages/llm/llm-pi-ai/tests/context.spec.ts`

**接口：**
- 使用任务 1 的 `EncodedFileAttachment` 和 `AttachmentStore.saveFiles`。
- 生成提示 wire part `{ type: 'file'; mediaType; data; name? }` 和持久内容块 `{ type: 'file'; attachment: FileAttachmentRef }`。

- [ ] 编写测试，证明混合文本／文件提示会持久化一个文件块及其后的带文件名提取文本，且提供方序列化忽略原始文件块但保留文本上下文。
- [ ] 运行这些测试，确认它们因不支持文件 wire／内容变体而失败。
- [ ] 实现原子通用文件接收、schema、内容块和适配器 fall-through 行为。
- [ ] 运行聚焦 API 与适配器测试并确认通过。
- [ ] 使用 `git commit -m "Admit session files"` 提交。

### 任务 3：Composer 接收与 A 风格草稿卡片

**文件：**
- 修改：`packages/client/ui-conversation/src/client/contract/slots.ts`
- 修改：`packages/client/ui-conversation/src/client/service.ts`
- 修改：`packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`
- 修改：`packages/client/ui-attachment/src/client/ComposerAttachments.tsx`
- 修改：`packages/client/ui-attachment/src/client/ComposerAttachments.module.css`
- 修改：`packages/client/ui-attachment/src/client/labels.ts`
- 测试：`packages/client/ui-conversation/tests/input-bar.client.spec.tsx`
- 测试：`packages/client/ui-attachment/tests/composer-attachments.client.spec.tsx`

**接口：**
- 使用任务 2 的通用 `PromptContentPart` wire。
- 生成一个统一草稿附件栏，包含 `onAddFiles`、文件选择器处理和安全移除。

- [ ] 编写 client 测试，证明首个附件操作会打开原生文件输入；CSV 渲染类型标志／名称／大小／状态卡片；拖入支持文件会添加它；移除后不进入提交 payload。
- [ ] 运行 client 测试，确认它们因 composer 仅暴露图片而失败。
- [ ] 实现统一草稿附件状态、二进制编码、输入选择器、A 风格卡片、本地化文案及统一拖放／粘贴校验。
- [ ] 运行 client 测试并确认通过。
- [ ] 使用 `git commit -m "Show file cards"` 提交。

### 任务 4：历史卡片、本地下载与端到端验证

**文件：**
- 修改：`packages/host/apiproxy/src/api/sessions.ts`
- 修改：`packages/host/apiproxy/src/api/sessions.schema.ts`
- 修改：`packages/client/runtime/src/client/sessions/session.ts`
- 修改：`packages/client/ui-attachment/src/client/index.ts`
- 修改：`packages/client/ui-attachment/src/client/MessageImages.tsx`
- 修改：`packages/client/ui-attachment/src/client/ComposerAttachments.module.css`
- 测试：`packages/host/apiproxy/tests/api-proxy-attachments.spec.ts`
- 测试：`packages/client/ui-attachment/tests/composer-attachments.client.spec.tsx`
- 测试：`apps/web/tests/file-attachments.e2e.ts`

**接口：**
- 使用任务 2 的持久 `file` 块。
- 生成一个经会话授权的原始文件下载和一个历史用户消息文件卡片渲染器。

- [ ] 编写测试，证明发送的 CSV/DOCX 会在历史重载后以名称／类型／大小重新出现，其会话路由返回原始字节，且页面支持选择器和拖放接收。
- [ ] 运行测试，确认它们因历史仅处理图片引用而失败。
- [ ] 实现授权文件路由、runtime loader、历史文件卡片 slot 和端到端浏览器流程。
- [ ] 运行聚焦测试、`pnpm run build` 和文件附件 E2E 测试；用两个准备好的演示文件人工测试 3080 UI。
- [ ] 使用 `git commit -m "Render sent files"` 提交。
