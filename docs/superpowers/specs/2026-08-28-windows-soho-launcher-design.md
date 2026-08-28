# Windows Soho Launcher Design

## Goal

Provide an internal Windows launch bundle that prepares and starts the
source checkout as a local Soho Harness web application without copying macOS
dependencies, credentials, DSH state, or MaxKB data from another machine.

## Scope

- Include the MIT-licensed Soho branding plugin as a source-owned local
  package.
- Start DSH on `127.0.0.1:3080` and MaxKB on `127.0.0.1:8080` by default.
- Exclude Dify from this release; it remains an optional, separately
  provisioned integration.
- Create Windows `.cmd` and PowerShell entrypoints and a portable Node setup
  helper. The helper prepares only a user-local DSH home.
- Preserve existing MaxKB and DSH data. Never seed an account, token, model
  key, session, attachment, or volume from the repository.

## Non-goals

- A native signed `.exe` or bundling Docker Desktop, Node.js, pnpm, or a model
  provider account.
- Exporting the current Mac's MaxKB data or credentials.
- Enabling Dify, which lacks a confirmed source and redistribution license.

## Architecture

`Start-Soho.cmd` invokes `Start-Soho.ps1`. The PowerShell wrapper validates
Windows prerequisites and host port availability, runs the Node setup helper,
and starts MaxKB Compose if Docker is available. It then launches the
platform-neutral Node web launcher with a per-user `DSH_HOME`.

The setup helper writes the source-owned branding and MaxKB package paths into
the user profile. It reads optional non-secret endpoint configuration from a
user-local JSON file. Credentials are deliberately supplied only through
environment variables or DSH credential settings after launch.

## Configuration and privacy

The public example configuration contains only host, port, and profile names.
The real configuration lives outside the repository under the user's local
application-data directory. It must not contain passwords, API keys, MaxKB
tokens, account JSON, attachments, session data, or absolute paths to another
computer.

`MAXKB_TOKEN` and `MAXKB_ACCOUNT_FILE` remain optional launch-time inputs.
Without them, the web UI still starts and the MaxKB panel can show its local
login page, but server-side MaxKB administration tools are unavailable until
the operator supplies authorization.

## Compatibility

Target: Windows 10/11 x64 with Docker Desktop in Linux-container mode, Node
22, pnpm 11, and access to the configured container registry. MaxKB's pinned
image publishes Linux amd64 and arm64 variants. Windows verification must be
performed on an actual Windows machine; macOS can validate generated files but
cannot prove the Windows launcher execution path.

## Acceptance criteria

1. A fresh checkout has no dependency on `/Users`, `.dsh`, or the local demo
   directories for the Soho plugin or MaxKB integration.
2. The Windows entrypoint writes all state under user-local application data,
   validates prerequisites, and reports occupied ports clearly.
3. DSH starts at port 3080 even when no MaxKB credential is supplied.
4. The profile contains the Soho brand and MaxKB packages from the checkout.
5. Tests assert the generated scripts, package references, privacy rules, and
   no-token launcher path.
