# Distributable MaxKB Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local MaxKB integration a versioned feature of the Soho Harness fork, usable from the normal 3080 Web profile without editing installed packages or relying on a macOS-specific path.

**Architecture:** Add two local extension packages: a host tool package that normalizes the MaxKB debug-session response and a client panel package that renders a dedicated trusted iframe for the explicitly configured MaxKB origin. Keep the generic browser sandbox unchanged. Add a MaxKB builder preset; only sessions on that preset open the workbench. Add platform-neutral setup/start scripts, a Docker Compose reference, a dry-run-first volume migration helper, and a compatibility matrix.

**Tech Stack:** Node.js ESM, Cordis plugin packages, DSH Web profile, pnpm, Docker Compose, shell integration tests, MaxKB HTTP API.

**Spec:** `docs/superpowers/specs/2026-08-26-local-file-attachments-design.md` and `docs/superpowers/specs/2026-08-26-skill-library-design.md`.

## Global Constraints

- No MaxKB account, token, or generated session data may be committed.
- The 3080 profile is `${DSH_HOME:-~/.dsh}` and must retain the Soho and Dify integrations already installed there.
- The panel accepts only an explicit HTTP(S) `baseUrl`; the demo configuration uses `http://127.0.0.1:8080`.
- The generic Dify browser sidebar and its sandbox policy are not weakened by this work.
- The MaxKB panel opens only if the current session preset is `maxkb-builder`.
- Launch behavior uses environment/config input only; no `/Users/...` path or account data appears in source.
- Attachment intake and skill-library code already committed on `master` remain unchanged except for verification/documentation.

---

### Task 1: Verify and document the existing distributable features

**Files:**
- Create: `docs/soho/local-features.md`
- Test: `dsh/tests/test-soho-feature-layout.sh`

**Interfaces:**
- Consumes: `packages/attachment/attachment-local`, `packages/client/ui-attachment`, `packages/host/skill-library`, `packages/client/ui-settings-skills`.
- Produces: a versioned feature map and an automated layout check for the attachment and skill-library packages.

- [ ] **Step 1: Write the failing layout check**

```bash
test -f packages/attachment/attachment-local/src/index.ts
test -f packages/client/ui-attachment/src/client/ComposerAttachments.tsx
test -f packages/host/skill-library/src/index.ts
test -f packages/client/ui-settings-skills/src/client/SkillsSettingsSection.tsx
test -f docs/soho/local-features.md
```

- [ ] **Step 2: Run the check and verify it fails because the feature map is absent**

Run: `bash dsh/tests/test-soho-feature-layout.sh`

- [ ] **Step 3: Write the feature map**

Document that attachments and imported skills are committed source features, while the Dify packages are currently profile-local artifacts that the installer will vendor from a declared local source rather than relying on an untracked profile edit.

- [ ] **Step 4: Run the check and verify it passes**

Run: `bash dsh/tests/test-soho-feature-layout.sh`

### Task 2: Create a source-owned MaxKB host plugin

**Files:**
- Create: `packages/extensions/maxkb/package.json`
- Create: `packages/extensions/maxkb/src/index.js`
- Create: `packages/extensions/maxkb/src/maxkb-client.js`
- Create: `packages/extensions/maxkb/tests/maxkb.spec.mjs`

**Interfaces:**
- Consumes: `baseUrl`, `token` or `tokenEnv`, and the MaxKB `GET /workspace/:workspaceId/application/:applicationId/open` endpoint.
- Produces: `maxkb_open_debug` result `{ ok, debugSessionId, workspaceId, applicationId, workflowUrl }`; it never returns a primitive response.

- [ ] **Step 1: Write a failing test for a primitive open response**

```js
const result = await openDebugResult({ openDebug: async () => 'debug-session-1' }, {
  workspaceId: 'default', applicationId: 'app-1', baseUrl: 'http://127.0.0.1:8080',
})
assert.deepEqual(result, {
  ok: true, debugSessionId: 'debug-session-1', workspaceId: 'default', applicationId: 'app-1',
  workflowUrl: 'http://127.0.0.1:8080/admin/application/workspace/app-1/workflow',
})
```

- [ ] **Step 2: Run the test and verify it fails because `openDebugResult` is absent**

Run: `node --test packages/extensions/maxkb/tests/maxkb.spec.mjs`

- [ ] **Step 3: Implement the minimum normalizer and tool registration**

Return a JSON object for every tool path, including errors. The system prompt explicitly tells the agent that `maxkb_open_debug` already opens the configured local panel and that it must not research source code to interpret a successful result.

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --test packages/extensions/maxkb/tests/maxkb.spec.mjs`

### Task 3: Create a dedicated trusted MaxKB client panel

**Files:**
- Create: `packages/extensions/maxkb-panel/package.json`
- Create: `packages/extensions/maxkb-panel/cordis.patch.yml`
- Create: `packages/extensions/maxkb-panel/src/index.js`
- Create: `packages/extensions/maxkb-panel/src/client.js`
- Create: `packages/extensions/maxkb-panel/tests/panel.spec.mjs`

**Interfaces:**
- Consumes: `maxkbState` projection (`baseUrl`, `workspaceId`, `applicationId`) and remote event `maxkb:open`.
- Produces: one sidebar tab of type `maxkb`, whose component is a normal iframe limited to the configured MaxKB URL; event navigation updates the iframe URL and activates the tab.

- [ ] **Step 1: Write a failing client-source test**

```js
assert.match(clientSource, /id:\s*['\"]maxkb['\"]/)
assert.match(clientSource, /iframe/)
assert.doesNotMatch(clientSource, /type:\s*['\"]browser['\"]/)
```

- [ ] **Step 2: Run the test and verify it fails because the package is absent**

Run: `node --test packages/extensions/maxkb-panel/tests/panel.spec.mjs`

- [ ] **Step 3: Implement the tab descriptor and event routing**

Register a custom MaxKB tab with `ctx.betterSidebar.registerTab`. The component uses the exact configured URL, does not expose a generic address field, and omits the generic browser sandbox. The URL guard accepts only the configured `baseUrl` plus `/admin` paths.

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --test packages/extensions/maxkb-panel/tests/panel.spec.mjs`

### Task 4: Install all integrations reproducibly into the 3080 Web profile

**Files:**
- Create: `dsh/setup-soho-web-macos.sh`
- Create: `dsh/start-soho-web-macos.sh`
- Create: `dsh/tests/test-soho-web-setup.sh`
- Modify: `docs/soho/local-features.md`

**Interfaces:**
- Consumes: a fork checkout path, `DSH_HOME`, the locally supplied Dify/Soho package paths, and `MAXKB_TOKEN` from `get-maxkb-poc-token.py`.
- Produces: a Web profile package manifest containing Soho, Dify, `@soho/dsh-maxkb`, and `@soho/dsh-maxkb-panel`, plus a Cordis patch that loads all required bundles.

- [ ] **Step 1: Write a failing temporary-home installer test**

```bash
DSH_HOME="$tmp/home" DSH_PROFILE=web bash dsh/setup-soho-web-macos.sh
node -e 'const p=require(process.argv[1]); if (!p.dependencies["@soho/dsh-maxkb"]) process.exit(1)' "$tmp/home/profiles/web/package.json"
rg -q '@soho/dsh-maxkb-panel' "$tmp/home/profiles/web/cordis.patch.yml"
```

- [ ] **Step 2: Run the test and verify it fails because the installer is absent**

Run: `bash dsh/tests/test-soho-web-setup.sh`

- [ ] **Step 3: Implement idempotent merge behavior**

Update only the package dependencies and loader entries owned by the Soho distribution. Preserve unrelated profile dependencies and existing user patch entries. Never persist tokens; the launcher obtains a temporary token at runtime and exports it only for the DSH process.

- [ ] **Step 4: Run the test and verify it passes**

Run: `bash dsh/tests/test-soho-web-setup.sh`

### Task 5: Verify locally on 3080 before any commit

**Files:**
- Modify: `docs/soho/local-features.md`

**Interfaces:**
- Consumes: MaxKB at `http://127.0.0.1:8080`, the configured Web profile, and the generated launch script.
- Produces: evidence that 3080 has attachments, Skills settings, Dify integration, and the MaxKB panel/tool contract.

- [ ] **Step 1: Run targeted automated tests**

Run: `node --test packages/extensions/maxkb/tests/maxkb.spec.mjs packages/extensions/maxkb-panel/tests/panel.spec.mjs && bash dsh/tests/test-soho-feature-layout.sh && bash dsh/tests/test-soho-web-setup.sh`

- [ ] **Step 2: Start the Web profile on 3080 through the launcher**

Run: `bash dsh/start-soho-web-macos.sh`

- [ ] **Step 3: Verify HTTP and visible frontend state**

Check that `curl -fsS http://127.0.0.1:3080/` succeeds and visually inspect the page after opening a MaxKB builder session. Confirm the right panel is an active MaxKB page, not a generic sandboxed browser page.

- [ ] **Step 4: Stop before commit and hand the local frontend to the user**

Do not create a Git commit until the user has viewed and approved the 3080 result.

### Task 6: Add the portable release boundary

**Files:**
- Create: `dsh/setup-soho-web.mjs`
- Create: `dsh/start-soho-web.mjs`
- Create: `dsh/get-maxkb-token.mjs`
- Create: `dsh/maxkb/docker-compose.yml`
- Create: `dsh/release/check-environment.mjs`
- Create: `dsh/release/migrate-maxkb-volumes.mjs`
- Create: `dsh/release/compatibility.md`
- Test: `dsh/tests/test-release-layout.sh`

**Interfaces:**
- Consumes: `DSH_HOME`, `DSH_PROFILE`, `MAXKB_BASE_URL`, either `MAXKB_TOKEN` or `MAXKB_ACCOUNT_FILE`, and Docker named volumes.
- Produces: a profile installer, a launch command that never persists a token, and an explicit, dry-run-first data-volume migration contract.

- [ ] **Step 1: Add layout assertions and run them red**
- [ ] **Step 2: Implement Node-based setup/launch and Compose assets**
- [ ] **Step 3: Implement environment reporting and guarded volume-copy commands**
- [ ] **Step 4: Run `bash dsh/tests/test-release-layout.sh` and verify it passes**
