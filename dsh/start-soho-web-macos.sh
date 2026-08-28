#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$repo_root/dsh/start-soho-web.mjs"
