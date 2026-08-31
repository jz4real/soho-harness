# Soho Harness Project Handoff

English | [中文](CODEX_HANDOFF.zh.md)

> Recheck Git and services before upgrades, migrations, or deletion. This handoff contains no credentials or personal paths.

## 1. Goal, scope, and product position

This Soho fork provides a locally deployed office-agent workbench:

- Soho branding with DSH conversation and agent features;
- local attachments, bounded extraction, and Skills;
- built-in office-generation Skills;
- a `Files | MaxKB` workbench and MaxKB tools;
- macOS and Windows launch paths, with optional Docker MaxKB.

It is a local demonstration and controlled-deployment base, not a multi-tenant cloud service. Dify is excluded.

## 2. Git baseline and commit state

| Item | Value |
| --- | --- |
| Working branch | `master` |
| Fork remote | `origin` → `https://github.com/jz4real/soho-harness.git` |
| Upstream remote | `upstream` → `https://github.com/deepseek-ai/deepseek-harness.git` |
| Recent workbench commit | `ef04b5e Improve Soho workbench interaction` |
| Recent MaxKB release commit | `cc72ba7 Add Soho local MaxKB support` |

The baseline is historical; inspect the actual state for every continuation:

```bash
git status --short --branch
git log --oneline -22
git remote -v
```

## 3. Completed capabilities and source locations

### Soho branding

- Source: `packages/extensions/soho-brand/`.
- Local profiles link to the checkout; personal paths never enter Git.
- Assets use the MIT license and need no personal source path.

### Attachments, workspace, and `/` invocation

- Local attachment host: `packages/attachment/attachment-local/`.
- Web controls: `packages/client/ui-attachment/`.
- Slash trigger: `packages/client/ui-input-trigger/`.
- Originals stay in the selected DSH workspace; only bounded text reaches a configured model, and input originals are never overwritten.

### Skills management

- Settings UI: `packages/client/ui-settings-skills/`.
- Skill-library host: `packages/host/skill-library/`.
- Built-in source: `dsh/builtin-skills/`.
- Settings → Skills imports directories with `SKILL.md`, then exposes `/skill-name` suggestions.
- Same-name user imports are explicit overrides and are never overwritten.

### Built-in office Skills

| Invocation | Directory | Purpose |
| --- | --- | --- |
| `/meeting-proposal` | `dsh/builtin-skills/meeting-proposal/` | Creates a meeting proposal from the bundled template and user material. |
| `/docx` | `dsh/builtin-skills/docx/` | Reads, creates, edits, and verifies DOCX. |
| `/xlsx` | `dsh/builtin-skills/xlsx/` | Reads CSV/XLSX and creates analysis workbooks. |
| `/pptx` | `dsh/builtin-skills/pptx/` | Creates or edits management PPTX. |

Each Skill uses `demo-fast-path: no-auto-install`: it checks once and fails explicitly when runtime dependencies are absent. It must not install packages, download Office/images, or retry for long periods.

### MaxKB and the right workbench

| Component | Location | Role |
| --- | --- | --- |
| API tools | `packages/extensions/maxkb/` | Health, application/workflow operations, and debug opening. |
| Right panel | `packages/extensions/maxkb-panel/` | `Files | MaxKB` tabs, trusted iframe, draggable splitter. |
| Installer | `dsh/setup-soho-web.mjs` | Registers local profile dependencies, panel/tools/presets, and Skills. |
| Launcher | `dsh/start-soho-web.mjs` | Checks MaxKB, passes local configuration, starts DSH Web. |
| Compose | `dsh/maxkb/docker-compose.yml` | Pinned MaxKB image and two named data volumes. |

MaxKB workflow-builder mode or the MaxKB tab loads only the configured local `/admin` page. The workbench uses the native attachment picker and no separate file storage.

The iframe accepts only the configured MaxKB origin and `/admin` paths, uses `no-referrer`, and never embeds arbitrary pages.

### Dify

Dify is not part of the current source release. Restoring it requires confirmed source, license, service/port, authentication, and UI design.

## 4. Local architecture, data, and security boundaries

```text
Browser (127.0.0.1:3080)
  ├─ DSH Web / Soho branding / sessions / Skills / attachments
  └─ Files | MaxKB workbench
       └─ MaxKB admin page (127.0.0.1:8080, optional Docker)
            └─ applications, workflows, knowledge bases, user data volumes
```

- Attachments are local; relevant text still reaches a configured cloud model.
- Compose binds loopback `127.0.0.1` by default.
- Git must not contain MaxKB users, credentials, tokens, workflows, volumes, cookies, sessions, attachments, or generated files.
- MaxKB tools use `MAXKB_TOKEN` or `MAXKB_ACCOUNT_FILE` and filter common sensitive output.
- Model keys belong in local settings or controlled deployment environments.
- Never commit user directories, account JSON, cookies, profiles, volumes, or environment files.

## 5. Installation, launch, ports, and daily operation

### Prerequisites

- Node.js 22.x and pnpm 11.x;
- Docker Desktop when MaxKB is needed;
- network access to dependencies and the image registry;
- preinstalled office runtimes for office-file demonstrations.

Run the read-only environment check:

```bash
node dsh/release/check-environment.mjs
```

### macOS / shell launch

```bash
pnpm install
docker compose -f dsh/maxkb/docker-compose.yml up -d
bash dsh/setup-soho-web-macos.sh
bash dsh/start-soho-web-macos.sh
```

- DSH Web defaults to `http://127.0.0.1:3080`.
- MaxKB defaults to `http://127.0.0.1:8080`.
- If 3080 is occupied, use the existing DSH or stop it explicitly before relaunching.
- For a blank MaxKB panel, inspect:

```bash
docker compose -f dsh/maxkb/docker-compose.yml ps
```

Use Compose `up -d` for an absent service; never use volume-deleting commands.

### Windows 10/11 x64 launch

1. Install Node.js 22 LTS, pnpm 11, and Docker Desktop with Linux containers / WSL 2.
2. Run `pnpm install` at the repository root.
3. Double-click `dsh\\windows\\Start-Soho.cmd`.

The launcher uses current-user settings and defaults to 3080 and 8080. It permits endpoint settings, not credentials or attachments. See `dsh/windows/README.zh-CN.md`.

### Updating the fork

```bash
git pull --ff-only origin master
node dsh/setup-soho-web.mjs
```

Restart 3080 to load current source; `link:` dependencies do not retain old Soho copies.

### Ports

- DSH defaults to 3080 and MaxKB to 8080.
- Use `MAXKB_PORT` or Windows local settings for MaxKB.
- Use `DSH_WEB_PORT` or Windows local settings for DSH.
- A future Dify service must have a distinct port.

## 6. MaxKB data, permissions, and migration

Compose has a pinned image and application/PostgreSQL volumes. It does not include another environment's applications, workflows, knowledge bases, models, users, or permissions.

Existing assets require controlled administrator export/import or a controlled volume and authorization migration.

Stop both source and target containers, then preview migration:

```bash
node dsh/release/migrate-maxkb-volumes.mjs \
  --source-data SOURCE_DATA --source-postgres SOURCE_POSTGRES \
  --target-data TARGET_DATA --target-postgres TARGET_POSTGRES
```

Use `--apply` only after target, backup, and sensitive-data checks. Never copy a running volume or commit volumes.

## 7. Completed verification

Recorded checks:

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

Manual verification covered branding, workbench tabs, picker, iframe dragging, local MaxKB, workflows, and Skills fast-fail behavior.

## 8. Known limits and pre-demo checks

1. Office Skills require preinstalled runtimes; test every demonstrated Skill on the target computer.
2. MaxKB administration needs a reachable service and legitimate login; API tools need local authorization.
3. Without `MAXKB_TOKEN` or `MAXKB_ACCOUNT_FILE`, browser login works but authorized administration tools do not.
4. Relevant attachment text crosses the configured provider boundary for cloud models.
5. Upstream synchronization requires isolated upgrade work and full regression.
6. Dify is not ready after a plain clone.

Minimum pre-demo checks:

```bash
git status --short --branch
docker compose -f dsh/maxkb/docker-compose.yml ps
node dsh/release/check-environment.mjs
```

Open 3080, upload a non-sensitive sample, invoke an office Skill, and select MaxKB mode.

## 9. Upstream upgrade process

Do not use GitHub Sync fork on `master`. Create an upgrade branch:

```bash
git switch master
git pull --ff-only origin master
git status
git branch backup/master-before-upstream-YYYY-MM-DD
git switch -c upgrade/upstream-YYYY-MM-DD
git fetch upstream --prune
git merge --no-ff upstream/master -m "Merge upstream updates YYYY-MM-DD"
```

Resolve intended conflict content, remove markers, stage each file, and continue the merge. Review DSH UI, plugin loading, build configuration, lockfile, and Soho extensions. Abort safely with:

```bash
git merge --abort
git switch master
```

Run section 7 verification and manual regression, then:

```bash
git push -u origin upgrade/upstream-YYYY-MM-DD
```

Merge through a pull request; do not rebase or force-push shared `master`.

## 10. Next steps and continuation rules

Priorities are Windows E2E validation, controlled office-runtime provisioning, MaxKB asset/account/permission/key/backup confirmation, then cloud multi-user architecture decisions.

A new Codex task must read this document, `dsh/README.zh-CN.md`, `docs/soho/local-features.md`, `dsh/maxkb/docker-compose.yml`, and relevant extensions before running:

```bash
git status --short --branch
git log --oneline -12
git remote -v
```

Until user confirmation: do not modify code, commit, stop Docker services, or delete volumes.
