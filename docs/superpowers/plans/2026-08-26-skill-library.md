# Skill Library Implementation Plan

English | [中文](2026-08-26-skill-library.zh.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Web Settings skill library that imports, manages, displays, and slash-invokes local DSH skills without changing the Plugin inventory.

**Architecture:** A host `skill-library` Remote service owns safe filesystem import and user-root state. A browser `ui-settings-skills` package contributes a separate Settings section and calls that service. The existing `ui-skill` source remains the only `/name` invocation path.

**Tech Stack:** TypeScript, Cordis, Typert Remote services, React, CSS modules, Vitest, Playwright.

**Spec:** [../specs/2026-08-26-skill-library-design.md](../specs/2026-08-26-skill-library-design.md)

## Global Constraints

- Install managed user skills only under `${DSH_HOME:-~/.dsh}/skills`.
- Keep disabled bundles under `${DSH_HOME:-~/.dsh}/skills-disabled`; never edit their `SKILL.md` to represent disabled state.
- Treat bundled/runtime skills as read-only and do not describe them as an online marketplace.
- Reject malformed, traversal, symlink-escaping, duplicate, or non-kebab-case imports.
- Preserve the existing Plugin Settings section and use the existing `/name` menu for invocation.

---

### Task 1: Define the host skill-library contract

**Files:** Create `packages/host/skill-library/{package.json,tsconfig.json,tsdown.config.ts,src/types.ts,src/index.ts,src/invariant.ts,tests/invariant.spec.ts,tests/skill-library.spec.ts}`; modify `packages/api/remotes/{package.json,tsconfig.client.json,src/client/index.ts}`.

**Interfaces:** `SkillLibraryGateway` exposes `list()`, `inspect(name)`, `importFolder(path, mode)`, `importArchive(bytes, mode)`, `setEnabled(name, enabled)`, and `remove(name)`. List entries carry `name`, `description`, `source`, `status`, `path`, `resourceCount`, `executablePaths`, and invocation policy.

- [ ] Write failing host tests for empty lists, user/bundled source separation, and a generated Typert Remote client face.
- [ ] Implement only the types, Remote decorators, and read-only list/inspect projection needed for those tests.
- [ ] Run `pnpm vitest packages/host/skill-library/tests/skill-library.spec.ts` and commit `feat: add skill library catalog`.

### Task 2: Implement safe folder installation

**Files:** Modify `packages/host/skill-library/src/index.ts`; cover the flow in `tests/skill-library.spec.ts`.

**Interfaces:** `validateBundle(root)` returns a parsed candidate or a typed rejection. `installFolder(candidate, mode)` stages work in a temporary sibling directory and atomically renames it into `~/.dsh/skills/<name>`.

- [ ] Write failing tests for a valid `SKILL.md`, malformed YAML, invalid name, nested bundle, symbolic link, collision rejection, explicit replacement, and rollback after an injected rename failure.
- [ ] Implement safe folder walking; accept exactly one bundle directory containing `SKILL.md`, reject all symbolic links, and stage then atomically rename the copy.
- [ ] Run `pnpm vitest packages/host/skill-library/tests/skill-library.spec.ts` and commit `feat: import validated skill bundles`.

### Task 3: Implement enable, disable, and removal

**Files:** Modify `packages/host/skill-library/src/index.ts`; cover the lifecycle in `tests/skill-library.spec.ts`.

**Interfaces:** `setEnabled(name, false)` moves one managed bundle to `skills-disabled`; `setEnabled(name, true)` reverses the move; `remove(name)` deletes only a managed user or disabled bundle.

- [ ] Write failing tests that assert disabled bundles leave the discovery root, survive a restart-shaped new gateway, and cannot mutate bundled entries.
- [ ] Implement atomic moves, stale-target rejection, and typed read-only failures.
- [ ] Run `pnpm vitest packages/host/skill-library/tests/skill-library.spec.ts` and commit `feat: manage local skill lifecycle`.

### Task 4: Build the Settings Skills section

**Files:** Create `packages/client/ui-settings-skills/{package.json,tsconfig.json,tsdown.config.ts,src/client/index.ts,src/client/SkillsSettingsSection.tsx,src/client/SkillLibraryTab.tsx,src/client/ImportSkillDialog.tsx,src/client/*.module.css,src/client/locales.ts,src/invariant.ts,tests/*.spec.tsx}`; modify `packages/bundle/web-app/{package.json,cordis.patch.yml}`.

**Interfaces:** The client injects `settings.section` with id `skills`; it consumes `remote.skillLibrary` and exposes no Plugin Settings tabs. `ImportSkillDialog` accepts a host-selected directory and requires an explicit replace action after a collision preview.

- [ ] Write browser-component tests for navigation order, My skills/Built-in skills tabs, loading/error/empty states, search, read-only bundled cards, and focus after successful import.
- [ ] Implement the localized Settings section, cards, details, enable/disable/remove controls, and import preview; retain accessible labels and keyboard behavior used by the existing Plugin Inventory tab.
- [ ] Run `pnpm vitest packages/client/ui-settings-skills/tests` and commit `feat: add skills settings surface`.

### Task 5: Wire desktop import and profile composition

**Files:** Modify `packages/bundle/web-app/{package.json,cordis.patch.yml}` and the Remote aggregate files from Task 1; create or extend focused API and Web E2E tests under `packages/host/skill-library/tests` and `apps/web/tests`.

**Interfaces:** Directory import uses the existing native directory picker and host `importFolder` Remote.

- [ ] Write failing E2E coverage that imports `meeting-proposal`, sees it in My skills, disables it, verifies it leaves the `/` candidates, re-enables it, and verifies it returns.
- [ ] Add the host and browser package rows to the Web bundle after their dependencies; wire the import controls to the named Remote methods.
- [ ] Run `pnpm vitest apps/web/tests/skill-library.e2e.ts` and commit `feat: wire skill library into web profile`.

### Task 6: Verify the real Soho profile and documentation

**Files:** Modify the paired package READMEs if public package behavior requires it; update the paired design and plan records with `verify-translation-pairing --write`.

- [ ] Start the local Web profile, open Settings → Skills, import the existing `meeting-proposal` bundle, and verify its source template remains byte-identical.
- [ ] Type `/meeting-proposal` in a new conversation, select the autocomplete candidate, and submit a draft request.
- [ ] Run `pnpm run lint`, `pnpm run doc-sync`, the focused host/client/E2E suites, and `git diff --check`; commit documentation separately as `docs: document skill library`.
