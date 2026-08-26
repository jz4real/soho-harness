# Local File Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build local-first generic file attachments for the web composer with durable storage, local extraction, model context, and A-style file cards.

**Architecture:** Extend the existing attachment seam and local store with a parallel generic-file path. Admit browser file wire parts at the API boundary, persist a `file` content block and a bounded extracted-text block, then render draft and historical cards through the existing conversation attachment slots. Provider adapters ignore the durable file block and consume the extracted text that follows it.

**Tech Stack:** TypeScript, React, Vitest, Zod, Node filesystem/crypto, JSZip, PDF.js.

**Spec:** `docs/superpowers/specs/2026-08-26-local-file-attachments-design.md`

## Global Constraints

- Keep original files below `DSH_HOME/attachments/v2/files`; never persist browser paths.
- Accept CSV, XLSX, DOCX, PDF, TXT, Markdown, JSON, and existing image types.
- Cap one generic file at 20 MiB, one message at 10 files / 50 MiB, one extracted file at 60,000 code points, and a message at 160,000 code points.
- Local extraction is model-independent; raw office/PDF bytes never enter a provider request.
- Follow TDD: every production change starts with a focused test that fails for the missing behavior.

---

### Task 1: Generic attachment vocabulary and local storage

**Files:**
- Modify: `packages/attachment/attachment/src/types.ts`
- Modify: `packages/attachment/attachment/src/index.ts`
- Modify: `packages/attachment/attachment-local/src/index.ts`
- Modify: `packages/attachment/attachment-local/src/store.ts`
- Create: `packages/attachment/attachment-local/src/file-extract.ts`
- Test: `packages/attachment/attachment-local/tests/file-extract.spec.ts`
- Test: `packages/attachment/attachment-local/tests/store.spec.ts`

**Interfaces:**
- Produces `FileAttachmentRef`, `SaveFileAttachment`, `StoredFileAttachment`, and `AttachmentStore.saveFiles/readFile`.
- Produces `extractFileText(input): Promise<{ text: string; truncated: boolean; status: 'ready' | 'unavailable' }>`.

- [ ] Write tests for CSV and UTF-8 text extraction, DOCX/XLSX ZIP XML extraction, PDF extraction, truncation, corrupted-office fallback, and content-addressed save/read integrity.
- [ ] Run the two test files and verify they fail because generic file vocabulary/extractor does not exist.
- [ ] Add the smallest generic-file vocabulary, private content-addressed local persistence, safe filename normalization, type/limit validation, and bounded extraction implementation.
- [ ] Run the two test files and verify they pass.
- [ ] Commit with `git commit -m "Store local files"`.

### Task 2: Session prompt admission and provider-safe context

**Files:**
- Modify: `packages/llm/llm/src/types.ts`
- Modify: `packages/host/apiproxy/src/api/sessions.ts`
- Modify: `packages/host/apiproxy/src/api/sessions.schema.ts`
- Modify: `packages/host/apiproxy/src/api-proxy.ts`
- Modify: `packages/llm/llm-deepseek/src/serialize.ts`
- Modify: `packages/llm/llm-pi-ai/src/context.ts`
- Test: `packages/host/apiproxy/tests/api-proxy-attachments.spec.ts`
- Test: `packages/llm/llm-deepseek/tests/serialize.spec.ts`
- Test: `packages/llm/llm-pi-ai/tests/context.spec.ts`

**Interfaces:**
- Consumes `EncodedFileAttachment` and `AttachmentStore.saveFiles` from Task 1.
- Produces prompt wire part `{ type: 'file'; mediaType; data; name? }` and durable `{ type: 'file'; attachment: FileAttachmentRef }` content blocks.

- [ ] Write tests proving a mixed text/file prompt persists a file block followed by extracted filename-tagged text, and that provider serialization omits raw file blocks while preserving the text context.
- [ ] Run those tests and verify they fail because the file wire/content variants are not supported.
- [ ] Implement atomic generic-file admission, schemas, content blocks, and adapter fall-through behavior.
- [ ] Run the focused API and adapter tests and verify they pass.
- [ ] Commit with `git commit -m "Admit session files"`.

### Task 3: Composer intake and A-style draft cards

**Files:**
- Modify: `packages/client/ui-conversation/src/client/contract/slots.ts`
- Modify: `packages/client/ui-conversation/src/client/service.ts`
- Modify: `packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`
- Modify: `packages/client/ui-attachment/src/client/ComposerAttachments.tsx`
- Modify: `packages/client/ui-attachment/src/client/ComposerAttachments.module.css`
- Modify: `packages/client/ui-attachment/src/client/labels.ts`
- Test: `packages/client/ui-conversation/tests/input-bar.client.spec.tsx`
- Test: `packages/client/ui-attachment/tests/composer-attachments.client.spec.tsx`

**Interfaces:**
- Consumes the generic `PromptContentPart` wire from Task 2.
- Produces one unified draft attachment rail with `onAddFiles`, file-picker handling, and safe removal.

- [ ] Write client tests proving the leading attachment action opens a native file input, a CSV renders a type badge/name/size/state card, dropping a supported file adds it, and removing it keeps it out of submit payload.
- [ ] Run the client tests and verify they fail because the composer exposes images only.
- [ ] Implement unified draft attachment state, binary encoding, input picker, A-style cards, localized copy, and unified drop/paste validation.
- [ ] Run the client tests and verify they pass.
- [ ] Commit with `git commit -m "Show file cards"`.

### Task 4: Historical cards, local download, and end-to-end validation

**Files:**
- Modify: `packages/host/apiproxy/src/api/sessions.ts`
- Modify: `packages/host/apiproxy/src/api/sessions.schema.ts`
- Modify: `packages/client/runtime/src/client/sessions/session.ts`
- Modify: `packages/client/ui-attachment/src/client/index.ts`
- Create: `packages/client/ui-attachment/src/client/MessageFiles.tsx`
- Create: `packages/client/ui-attachment/src/client/MessageFiles.module.css`
- Test: `packages/host/apiproxy/tests/api-proxy-attachments.spec.ts`
- Test: `packages/client/ui-attachment/tests/message-files.client.spec.tsx`
- Test: `apps/web/tests/file-attachments.e2e.ts`

**Interfaces:**
- Consumes durable `file` blocks from Task 2.
- Produces a session-authorized original-file download and one historical user-message file-card renderer.

- [ ] Write tests proving a sent CSV/DOCX reappears after history reload with its name/type/size, its session route returns original bytes, and the page supports picker and drop intake.
- [ ] Run those tests and verify they fail because history only handles image references.
- [ ] Implement the authorized file route, runtime loader, historical file-card slot, and end-to-end browser flow.
- [ ] Run targeted tests, `pnpm run build`, and the file-attachment E2E test; manually exercise the 3080 UI with the two prepared demo files.
- [ ] Commit with `git commit -m "Render sent files"`.
