#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
node "$repo_root/dsh/setup-soho-web.mjs"
if [[ "${SOHO_SKIP_INSTALL:-0}" != "1" ]]; then
  pnpm --dir "${DSH_HOME:-$HOME/.dsh}/profiles/${DSH_PROFILE:-web}" install --offline
fi
