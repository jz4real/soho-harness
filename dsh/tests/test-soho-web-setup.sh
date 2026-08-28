#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

node --input-type=module - "$tmp/home/profiles/web" <<'NODE'
import { mkdir, writeFile } from 'node:fs/promises'
const profile = process.argv[2]
await mkdir(profile, { recursive: true })
await writeFile(`${profile}/package.json`, JSON.stringify({
  name: 'dsh-profile-web', private: true,
  dependencies: {
    '@soho/dsh-brand-plugin': 'file:/existing/soho-brand-plugin',
    'dsh-dify': 'file:/existing/dsh-dify.tgz',
  },
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } },
}, null, 2))
await writeFile(`${profile}/cordis.patch.yml`, "- insert:\n    - id: soho-brand\n      name: '@soho/dsh-brand-plugin'\n")
await mkdir(`${process.argv[2]}/../../skills/docx`, { recursive: true })
await writeFile(`${process.argv[2]}/../../skills/docx/SKILL.md`, '# Personal DOCX skill\n')
NODE

DSH_HOME="$tmp/home" SOHO_SKIP_INSTALL=1 node "$root/dsh/setup-soho-web.mjs"

node --input-type=module - "$tmp/home/profiles/web/package.json" <<'NODE'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const value = JSON.parse(await readFile(process.argv[2], 'utf8'))
assert.equal(value.dependencies['dsh-dify'], undefined)
assert.match(value.dependencies['@soho/dsh-maxkb'], /^link:/)
assert.match(value.dependencies['@soho/dsh-maxkb-panel'], /^link:/)
assert.match(value.dependencies['@soho/dsh-brand-plugin'], /^link:.*packages[/\\]extensions[/\\]soho-brand$/)
assert(value.dsh.profile.bundles.includes('@soho/dsh-maxkb-panel'))
assert(!value.dsh.profile.bundles.some(name => name.startsWith('dsh-dify')))
NODE

rg -q "@soho/dsh-maxkb" "$tmp/home/profiles/web/cordis.patch.yml"
rg -q "MAXKB_TOKEN" "$tmp/home/profiles/web/cordis.patch.yml"
test -f "$tmp/home/.agent-presets/maxkb-builder/preset.yml"
rg -q "MaxKB 工作流构建" "$tmp/home/.agent-presets/maxkb-builder/preset.yml"
rg -q "@deepseek-ai/dsh-tool-bash" "$tmp/home/.agent-presets/maxkb-builder/agent.cordis.yml"
for skill in meeting-proposal docx xlsx pptx; do
  test -f "$tmp/home/skills/$skill/SKILL.md"
done
grep -qx '# Personal DOCX skill' "$tmp/home/skills/docx/SKILL.md"
rg -q 'demo-fast-path: no-auto-install' "$root/dsh/builtin-skills/docx/SKILL.md"
for skill in xlsx pptx meeting-proposal; do
  rg -q 'demo-fast-path: no-auto-install' "$tmp/home/skills/$skill/SKILL.md"
done

echo "soho web setup: ok"
