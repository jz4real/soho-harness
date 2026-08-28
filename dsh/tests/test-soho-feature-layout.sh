#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"

test -f "$root/packages/attachment/attachment-local/src/index.ts"
test -f "$root/packages/client/ui-attachment/src/client/ComposerAttachments.tsx"
test -f "$root/packages/host/skill-library/src/index.ts"
test -f "$root/packages/client/ui-settings-skills/src/client/SkillsSettingsSection.tsx"
test -f "$root/docs/soho/local-features.md"
test -f "$root/packages/extensions/soho-brand/LICENSE"
test -f "$root/packages/extensions/maxkb-panel/src/client.js"
rg -q 'source-owned' "$root/docs/soho/local-features.md"
rg -q 'Dify is not included' "$root/docs/soho/local-features.md"
rg -q "Soho 右侧工作台" "$root/packages/extensions/maxkb-panel/src/client.js"
rg -q "label: 'Files'" "$root/packages/extensions/maxkb-panel/src/client.js"
rg -q "label: 'MaxKB'" "$root/packages/extensions/maxkb-panel/src/client.js"
rg -q 'delete manifest.dependencies\[retiredPackage\]' "$root/dsh/setup-soho-web.mjs"
if rg -n '/Users/jeffreyzhang|风控能力验证-Mac演示包|soho-brand-plugin"\s*:\s*"file:/Users' "$root/dsh" "$root/docs/soho" -g '!test-*'; then exit 1; fi

echo "soho feature layout: ok"
