# Source-Owned MaxKB Tabs Design

## Goal

Keep the existing Soho Harness main UI and place MaxKB in the established right-hand `Files | MaxKB` workbench rather than opening a separate fixed overlay.

## Scope

- A source-owned, lightweight right-hand workbench provides a `Files` tab and a `MaxKB` tab.
- Selecting the `maxkb-builder` preset activates the MaxKB tab and loads only a trusted local MaxKB URL in an iframe.
- The workbench never sends passwords, tokens, session data, or user files to Git or a remote endpoint.
- Dify and the previous external `dsh-dify-*` packages are out of scope.
- The source setup script installs only source-owned packages from the checkout and has no user-specific absolute paths.

## Non-goals

- Shipping a MaxKB account, a model key, an existing application, workflow, knowledge base, Docker volume, or browser login session.
- Reproducing Dify functionality.
- Changing the left navigation, Soho theme, conversation layout, attachment UI, or Skills UI.

## Design

`@soho/dsh-maxkb-panel` remains the single client package.  It mounts a right-anchored workbench as one stable layout surface, with a compact tab strip.  The `Files` tab gives a neutral local-files placeholder; the `MaxKB` tab contains the existing trusted iframe.  It is opened only for `maxkb-builder`, and selecting another preset hides the workbench.  This preserves the existing visual structure without depending on the heavyweight external Dify sidebar package.

The iframe target must match the configured MaxKB origin and start with `/admin`.  The base URL defaults to `http://127.0.0.1:8080`, while launch configuration can override it through local environment/configuration.  No token is rendered or persisted by this UI.

## Distribution and Documentation

The source setup script continues to register the panel and MaxKB tools using checkout-relative file dependencies.  The Windows README describes the first-run prerequisites, ports, local data boundaries, and that a MaxKB account/workflow must be created or imported after startup.  Automated layout tests assert no Dify package dependency, no user absolute path, no token literal, and the tabbed workbench behavior.
