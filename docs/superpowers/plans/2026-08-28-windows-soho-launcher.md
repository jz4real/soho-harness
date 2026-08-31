# Windows Soho Launcher Implementation Plan

English | [中文](2026-08-28-windows-soho-launcher.zh.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a source-owned Windows launcher that opens Soho Harness at 3080 and optionally starts MaxKB at 8080 without embedding credentials or macOS paths.

**Architecture:** A platform-neutral setup helper owns profile generation; thin Windows CMD and PowerShell wrappers own prerequisite, port, and Docker checks. A local configuration file supplies only public endpoint settings. The launcher no longer prevents the DSH UI from starting when MaxKB authorization is absent.

**Tech Stack:** Node.js 22, pnpm 11, PowerShell, Docker Compose, DSH profile bundles.

**Spec:** `docs/superpowers/specs/2026-08-28-windows-soho-launcher-design.md`

## Global Constraints

- Do not commit credentials, tokens, account JSON, local DSH state, container volumes, attachments, or generated sessions.
- Default ports are DSH 3080 and MaxKB 8080; Dify is excluded.
- Use only paths derived from the checkout or the current user's home/application-data directory.
- Keep existing user profile rows and data intact.

---

### Task 1: Source-own the Soho branding package

**Files:**
- Create: `packages/extensions/soho-brand/**`
- Modify: `dsh/setup-soho-web.mjs`
- Test: `dsh/tests/test-soho-web-setup.sh`

**Interfaces:**
- Produces package dependency `@soho/dsh-brand-plugin` pointing at `packages/extensions/soho-brand`.

- [ ] Copy the MIT plugin source and its LICENSE into the source tree.
- [ ] Write a failing setup test that expects a clean profile manifest to contain a checkout-derived Soho branding dependency.
- [ ] Update setup logic to add the source-owned package and its patch row idempotently.
- [ ] Run the setup test and assert no user-specific path appears in generated output.

### Task 2: Add launcher configuration and no-token startup

**Files:**
- Create: `dsh/config/soho.example.json`
- Modify: `dsh/start-soho-web.mjs`
- Test: `dsh/tests/test-soho-web-start.sh`

**Interfaces:**
- Consumes optional `SOHO_CONFIG_FILE`, `MAXKB_BASE_URL`, `DSH_WEB_PORT`, and `MAXKB_TOKEN`.
- Produces a DSH process with MaxKB tools authorized only when a token is supplied.

- [ ] Write a failing test that starts the launcher against a local HTTP fixture without token material and expects it to invoke DSH rather than throw.
- [ ] Parse non-secret endpoint settings and preserve environment variable precedence.
- [ ] Change the launcher to warn, rather than throw, when no MaxKB authorization is supplied.
- [ ] Run the start test with and without a token.

### Task 3: Add the Windows entrypoints

**Files:**
- Create: `dsh/windows/Start-Soho.cmd`
- Create: `dsh/windows/Start-Soho.ps1`
- Create: `dsh/windows/README.zh-CN.md`
- Test: `dsh/tests/test-windows-launcher-layout.sh`

**Interfaces:**
- CMD entrypoint delegates to PowerShell with the checkout root.
- PowerShell validates `node`, `pnpm`, `docker`, and ports before invoking the Node scripts.

- [ ] Write a failing layout test for the entrypoints, required port variables, non-secret configuration path, and absence of macOS literals.
- [ ] Add the CMD shim and PowerShell wrapper with safe error messages and local application-data defaults.
- [ ] Add the internal Windows readme with prerequisites and one-click setup steps.
- [ ] Run the layout test and static PowerShell syntax validation where available.

### Task 4: Fresh-home verification and release documentation

**Files:**
- Modify: `dsh/tests/test-soho-feature-layout.sh`
- Modify: `dsh/tests/test-release-layout.sh`
- Modify: `docs/soho/local-features.md`

**Interfaces:**
- Produces an auditable release check that rejects credentials and external demo paths.

- [ ] Write a failing test that rejects the historical external Soho/Dify paths and verifies a fresh profile is source-owned for the in-scope features.
- [ ] Update release tests and documentation to state Dify is not in this release.
- [ ] Run all focused tests, the extension Node tests, `git diff --check`, and build the local web UI for manual inspection.
