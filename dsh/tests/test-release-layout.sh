#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"

test -f "$root/dsh/setup-soho-web.mjs"
test -f "$root/dsh/start-soho-web.mjs"
test -f "$root/dsh/README.zh-CN.md"
test -f "$root/dsh/release/check-environment.mjs"
test -f "$root/dsh/release/migrate-maxkb-volumes.mjs"
test -f "$root/dsh/maxkb/docker-compose.yml"
test -f "$root/dsh/release/compatibility.md"
rg -q 'MAXKB_IMAGE' "$root/dsh/maxkb/docker-compose.yml"
rg -q 'Windows' "$root/dsh/release/compatibility.md"
rg -q 'macOS' "$root/dsh/release/compatibility.md"
rg -q 'link:' "$root/dsh/README.zh-CN.md"
rg -q 'MaxKB' "$root/dsh/README.zh-CN.md"
rg -q 'fileURLToPath' "$root/dsh/setup-soho-web.mjs"
rg -q 'fileURLToPath' "$root/dsh/start-soho-web.mjs"
if rg -n '/Users/' "$root/dsh" -g '!test-*'; then exit 1; fi
node "$root/dsh/release/check-environment.mjs" --json >/dev/null
node "$root/dsh/release/migrate-maxkb-volumes.mjs" --help | rg -q -- '--source-data'

echo "soho release layout: ok"
