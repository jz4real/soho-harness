#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
cmd="$root/dsh/windows/Start-Soho.cmd"
ps1="$root/dsh/windows/Start-Soho.ps1"
readme="$root/dsh/windows/README.zh-CN.md"
example="$root/dsh/config/soho.example.json"

test -f "$cmd"
test -f "$ps1"
test -f "$readme"
test -f "$example"
rg -q 'Start-Soho.ps1' "$cmd"
rg -q 'LOCALAPPDATA' "$ps1"
rg -q 'docker compose' "$ps1"
rg -q 'DSH_WEB_PORT' "$ps1"
rg -q 'MAXKB_PORT' "$ps1"
rg -q '\$env:MAXKB_PORT\s*=\s*\[string\]\$maxkbPort' "$ps1"
rg -q 'profiles\\web' "$ps1"
rg -q 'install --offline' "$ps1"
if rg -q 'install --offline --force' "$ps1"; then exit 1; fi
rg -q '3080' "$readme"
rg -q '8080' "$readme"
if rg -n '/Users/|MAXKB_TOKEN\s*[:=]\s*[^$]' "$cmd" "$ps1" "$example"; then exit 1; fi

echo 'windows launcher layout: ok'
