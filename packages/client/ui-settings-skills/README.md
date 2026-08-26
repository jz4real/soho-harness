# @deepseek-ai/dsh-client-ui-settings-skills

English | [中文](README.zh.md)

Standalone Skills section for Web Settings. It keeps Plugins unchanged and offers **My skills** for managed local bundles plus **Built-in skills** for profile-provided read-only bundles. The section supports local search, folder selection, an import preview, explicit same-name replacement, enable/disable, and managed deletion.

All visual rules use existing DSH theme tokens, so a branding package such as `soho-brand-plugin` continues to determine colors and typography without being coupled to this feature. Each card explains the existing slash call: type `/skill-name` in a conversation, select the native suggestion, then add the task.

## Model Experience

None, as this browser Settings surface only explains and manages the existing `/skill-name` contract; it registers no prompt, tool, or model-selection behavior.

#### KV Cache effect

None; this package contributes browser Settings UI only.

## Known Limitations and Deferred Work

- **Folder picker only** — the first release deliberately does not accept ZIP archives.
- **No marketplace feed** — the built-in tab can be empty when the current runtime has no bundled skills.
