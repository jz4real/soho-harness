# Agent Note: Keep Soho MaxKB launch configuration coherent

Status: implemented

English | [中文](2026-08-31-soho-maxkb-launcher-configuration.zh.md)

## Problem

The Soho MaxKB tool accepted `MAXKB_BASE_URL`, while the right-side panel fell back to 8080 unless a profile patch supplied a separate value. A Windows deployment using `maxkbPort` could therefore run the tool and show a panel for a different address. The launcher also failed before a Compose-started MaxKB finished initialization, and its normal Compose status check could not distinguish a responding local service that another Compose project or manual container owns.

## Decision

The MaxKB panel resolves its host configuration from an explicit `baseUrl`, then `MAXKB_BASE_URL`, then the loopback 8080 default. `dsh/start-soho-web.mjs` waits up to 30 seconds for its configured service before launching DSH. After a loopback service responds, it reads the repository Compose status for at most three seconds only to warn when that project has no running service; it never starts, stops, migrates, or changes an existing container or volume. The launcher keeps `MAXKB_TOKEN` and `MAXKB_ACCOUNT_FILE` as the only account inputs and removes the unused Python helper that derived an account file from an unrelated directory layout.

## Alternatives considered

**Pass the address through browser-only state.** Rejected because the browser cannot safely read the process environment, and the panel host projection already owns the configured MaxKB address.

**Treat every listener on the configured port as this Compose project.** Rejected because it hides an operationally significant ownership mismatch and would invite lifecycle operations against another deployment.

**Fail as soon as the first health request fails.** Rejected because a successful Compose start commonly precedes HTTP readiness by a short interval.

## Consequences

Non-default MaxKB ports reach the panel and the tools through the same launcher setting. Startup and Compose diagnostics are bounded, and an unmanaged local service remains usable but is identified in launcher diagnostics. The panel's default address, layout, tabs, and interaction remain unchanged. `dsh/tests/test-soho-web-start.mjs` exercises delayed readiness, the Compose diagnostic timeout, and the unmanaged-service warning; `packages/extensions/maxkb-panel/tests/panel.spec.mjs` exercises address precedence.
