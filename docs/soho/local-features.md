# Soho Harness local features

English | [中文](local-features.zh.md)

This fork includes the following features as versioned source code:

- **Local file attachments:** `packages/attachment/attachment-local` stores original files under the selected DSH home, extracts bounded local text, and supplies only that text to the configured model provider. The web controls live in `packages/client/ui-attachment`.
- **Skills settings:** `packages/host/skill-library` manages imported skill folders, and `packages/client/ui-settings-skills` adds the Settings → Skills screen. Imported skills are available through the existing `/skill-name` conversation flow.

**MaxKB integration** is source-owned in this fork: the host tools, `Files | MaxKB` right-side workbench, agent preset installer, portable launcher, and Compose assets are all under `packages/extensions/maxkb*` and `dsh/`. The workbench is a layout surface rather than a popup; its iframe accepts only the configured local MaxKB `/admin` origin.

**Soho branding** is source-owned under `packages/extensions/soho-brand` and is installed by the setup helper for a clean profile. It is MIT-licensed and does not depend on any user-specific asset path.

**Built-in office skills** are source-owned under `dsh/builtin-skills`: a clean profile receives `/meeting-proposal`, `/docx`, `/xlsx`, and `/pptx`. They use a fast-fail preflight policy: no automatic Python/npm/Office/Docker download or dependency installation is allowed during a conversation. An imported skill with the same name is kept as the user's explicit override.

**Dify is not included** in the current release. The setup helper removes old `dsh-dify-*` profile references before it registers source-owned packages, so a clean clone cannot accidentally boot two competing right-side layouts. Dify uses separate services and is deliberately excluded until its approved source and license are available.

For Windows, use `dsh/windows/Start-Soho.cmd`. It prepares a local DSH home, starts MaxKB at 8080 when Docker is available, and opens DSH at 3080. The launcher may start without MaxKB authorization, but MaxKB administration tools then remain unavailable until the operator supplies a local token or account file.

No service credentials, MaxKB API tokens, conversation logs, attachments, or generated artifacts belong in Git. The Web launcher reads a short-lived token from the operator's local MaxKB installation only when it is explicitly provided at start time.
