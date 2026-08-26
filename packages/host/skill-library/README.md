# @deepseek-ai/dsh-host-skill-library

English | [中文](README.zh.md)

Host-owned local Skill Library service. `SkillLibraryGateway` exposes a generated `skillLibrary` Remote for listing installed skills, inspecting a selected folder, importing it after confirmation, replacing a same-name managed skill, and enabling, disabling, or removing a managed skill. It recognizes only one top-level `SKILL.md` bundle and rejects symbolic links and nested skill bundles before copying anything.

Enabled personal skills live in `~/.dsh/skills`; disabled skills move to `~/.dsh/skills-disabled`. This lets the existing filesystem discovery provider and slash suggestion mechanism remain the sole invocation authority. Built-in skills, if the active profile provides a bundle root, are listed as read-only and are never mutated by this package.

## Model Experience

Indirectly, through the existing filesystem skill provider and `ui-skill`: this package manages which local bundles are discoverable, while those consumers own the model-facing instruction loading and slash invocation.

#### KV Cache effect

None; no provider request is assembled here.

## Known Limitations and Deferred Work

- **Folder import only** — archive/ZIP import is intentionally deferred until a separate safe extraction boundary is designed.
- **No online marketplace** — the built-in tab reflects only skills physically supplied by the active runtime/profile.
