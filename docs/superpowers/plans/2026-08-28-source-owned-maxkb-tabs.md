# Source-Owned MaxKB Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the MaxKB fixed overlay with a source-owned right-hand `Files | MaxKB` workbench that works after a clean macOS or Windows clone.

**Architecture:** Keep `@soho/dsh-maxkb-panel` as the one client extension. It owns a small tab state and renders a trusted MaxKB iframe only within its MaxKB tab. The setup script remains the sole profile-registration point.

**Tech Stack:** DSH client runtime, React JSX runtime, Node test runner, PowerShell/cmd launchers.

**Spec:** `docs/superpowers/specs/2026-08-28-source-owned-maxkb-tabs-design.md`

## Global Constraints

- Do not add Dify or `dsh-dify-*` dependencies.
- Do not add tokens, passwords, `/Users/...` paths, Docker volumes, or MaxKB user data to Git.
- Preserve the existing Soho main UI; only the MaxKB workbench surface changes.
- Support macOS and Windows from a checkout-relative setup path.

---

### Task 1: Define the tabbed-workbench regression contract

**Files:**
- Modify: `packages/extensions/maxkb-panel/tests/panel.spec.mjs`
- Modify: `dsh/tests/test-soho-feature-layout.sh`

- [ ] Add assertions that require `Files` and `MaxKB` tabs and reject a fixed overlay / close control.
- [ ] Run `node --test packages/extensions/maxkb-panel/tests/panel.spec.mjs` and observe the expected failure against the overlay implementation.

### Task 2: Implement the source-owned tabbed MaxKB workbench

**Files:**
- Modify: `packages/extensions/maxkb-panel/src/client.js`

- [ ] Replace the fixed overlay component with the tabbed workbench while preserving trusted URL validation and `maxkb-builder` preset activation.
- [ ] Re-run the panel tests and confirm they pass.

### Task 3: Document portable use and verify the release layout

**Files:**
- Modify: `dsh/windows/README.zh-CN.md`
- Modify: `dsh/tests/test-windows-launcher-layout.sh`

- [ ] Explain first-run MaxKB login/data boundaries and the `Files | MaxKB` workbench.
- [ ] Verify source paths, secret absence, Dify exclusion, setup script behavior, and Windows layout tests.
