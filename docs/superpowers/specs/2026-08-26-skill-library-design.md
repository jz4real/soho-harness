# Skill library settings design

English | [中文](2026-08-26-skill-library-design.zh.md)

## Scope

Add a separate **Skills** settings section to the Web profile. Keep the existing **Plugins** section unchanged: plugins are executable runtime components, while skills are instruction bundles and optional resources for an agent.

The section has two read models:

- **My skills** lists the managed user skills in `${DSH_HOME:-~/.dsh}/skills` and the locally retained disabled copies in `${DSH_HOME:-~/.dsh}/skills-disabled`.
- **Built-in skills** lists skills supplied by the active profile's bundled or runtime providers. It is read-only and may be empty. The product must not present it as an online marketplace.

The first release imports local skill folders and `.zip` archives into the user root. A project-local skill root remains project-specific and is not managed by this global screen. A remote or company marketplace is out of scope.

## User experience

The Settings navigation gains a **Skills** item beside Plugins. Its tabs are **My skills** and **Built-in skills**.

My skills has an **Import skill** button and a searchable card list. Each card shows the kebab-case command name, description, source path, enabled state, and resource summary. A user can view the skill instructions, disable or enable it, and remove a user-installed skill. Removing a skill removes only its managed copy under `~/.dsh/skills`; it never touches an original folder selected for import.

Built-in skills has the same searchable card presentation without mutating actions. An empty state states that the active profile supplies no built-in skills.

Import opens a dialog with two inputs: choose or drop a skill folder, or choose or drop a `.zip` archive. The dialog first validates the candidate and shows its name, description, entry file, resource count, and any executable files before exposing the final **Import to My skills** action. A name collision never overwrites an existing skill: the dialog requires an explicit replace confirmation, or the user cancels.

After a successful import the dialog closes, My skills refreshes, and the new card receives focus. The product also shows a short callout: type `/<name>` in a conversation, choose the matching suggestion, then add the task prompt.

## Invocation

Do not build a second skill-command system. The Web profile already exposes every user-invocable skill through the `/` input source. Selecting a candidate inserts `/<name> `; the existing host pre-step handler loads its `SKILL.md` instructions when the message is sent.

Imported skills default to `user-invocable: true` and `model-invocable: true` when those frontmatter fields are absent, matching the filesystem provider. The UI does not promise invocation for a skill that explicitly sets `user-invocable: false`; its card explains that it is unavailable from the slash menu.

## Host design

Add a host-side `skill-library` plugin. It owns a dedicated remote API rather than extending `skill.list`, because the existing API deliberately exposes only per-session invocation data and hides provider/source details.

The API has four operations:

- `list()` returns user-root and built-in entries with source category, path, description, invocation policy, and resource summary.
- `inspect(name)` returns the validated frontmatter and a safe preview of the body for the details dialog.
- `import(candidate, mode)` validates a folder or uploaded archive and installs it atomically under the user root; `mode` is `reject` or explicit `replace`.
- `setEnabled(name, enabled)` and `remove(name)` operate only on managed user-root entries.

Import accepts exactly one top-level skill bundle containing `SKILL.md`. It rejects path traversal, symlinks that resolve outside the candidate, malformed YAML, non-kebab-case names, duplicate bundles, and archive entries outside the bundle. The host stages extraction in a temporary directory, validates it, then renames it into place. A failure leaves both the existing skill and its resources intact.

Enabled state is represented by location, not by editing the imported `SKILL.md`: a disabled bundle moves atomically from `~/.dsh/skills/<name>` to `~/.dsh/skills-disabled/<name>`, and enabling reverses that move. The skill filesystem provider continues to own discovery, so moving a bundle out of its root makes it disappear from both automatic discovery and the slash menu without changing user content.

## Client design

Add a browser-side `ui-settings-skills` plugin. It contributes one `settings.section` entry with id `skills`, reusing the existing Settings section contract rather than adding a tab inside Plugins. It renders the two tabs, import dialog, card list, empty states, accessible focus handling, and localized Chinese and English text.

The profile installs the host and browser halves as a local bundle, comparable to the existing Soho customization. The standard Plugins section and the `ui-skill` slash source remain independent.

## Validation

Tests cover frontmatter and archive validation, traversal and collision rejection, atomic replace and rollback, enable/disable visibility, read-only built-in entries, source separation, and locale labels. Browser tests cover the new Settings entry, import preview and confirmation, card actions, empty states, and slash-menu discovery after importing a skill. Manual acceptance verifies importing `meeting-proposal`, selecting `/meeting-proposal`, and generating a new Word file without changing the bundled source template.

## Out of scope

This release does not install npm plugins, run skill scripts automatically, fetch remote skill packages, synchronize an enterprise catalog, or alter the existing plugin inventory. Those are separate trust and distribution features.
