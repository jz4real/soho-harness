import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('registers a resizable MaxKB workbench without overriding the DSH root width', async () => {
  const clientSource = await readFile(new URL('../src/client.js', import.meta.url), 'utf8')

  assert.match(clientSource, /aria-label': 'Soho 右侧工作台'/)
  assert.match(clientSource, /label: 'Files'/)
  assert.match(clientSource, /label: 'MaxKB'/)
  assert.match(clientSource, /iframe/)
  assert.match(clientSource, /--soho-workbench-width/)
  assert.match(clientSource, /margin-right/)
  assert.match(clientSource, /aria-label': '调整右侧工作台宽度'/)
  assert.match(clientSource, /onPointerDown/)
  assert.match(clientSource, /const minimum = 280/)
  assert.match(clientSource, /Math\.floor\(window\.innerWidth \* 0\.65\)/)
  assert.match(clientSource, /requestAnimationFrame/)
  assert.match(clientSource, /setPointerCapture/)
  assert.match(clientSource, /releasePointerCapture/)
  assert.match(clientSource, /data-soho-workbench-resizing/)
  assert.match(clientSource, /sohoWorkbenchResizing/)
  assert.match(clientSource, /打开附件选择器/)
  assert.match(clientSource, /button\[aria-label="Add attachments"\]/)
  assert.doesNotMatch(clientSource, /#root \{ margin-right: var\(--soho-workbench-width\); width:/)
  assert.doesNotMatch(clientSource, /关闭 MaxKB 工作台/)
})

test('opens the MaxKB panel only for the MaxKB workflow builder preset', async () => {
  const clientSource = await readFile(new URL('../src/client.js', import.meta.url), 'utf8')

  assert.match(clientSource, /MAXKB_PRESET_ID\s*=\s*['\"]maxkb-builder['\"]/)
  assert.match(clientSource, /selectedPreset\(sessionId\)\s*===\s*MAXKB_PRESET_ID/)
  assert.match(clientSource, /activeTab = agentPreset === MAXKB_PRESET_ID \? 'maxkb' : 'files'/)
})

test('is self-contained and does not rely on the retired Dify sidebar package', async () => {
  const packageSource = await readFile(new URL('../package.json', import.meta.url), 'utf8')
  const clientSource = await readFile(new URL('../src/client.js', import.meta.url), 'utf8')

  assert.doesNotMatch(packageSource, /dsh-dify-sidebar/)
  assert.match(clientSource, /react-dom\/client/)
  assert.match(clientSource, /createRoot/)
  assert.doesNotMatch(clientSource, /dsh-dify-/)
})

test('keeps source-only Soho plugins out of the host tsdown workspace build', async () => {
  const [panelConfig, maxkbConfig, brandConfig] = await Promise.all([
    readFile(new URL('../tsdown.config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../maxkb/tsdown.config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../soho-brand/tsdown.config.ts', import.meta.url), 'utf8'),
  ])

  assert.match(panelConfig, /entry:\s*''/)
  assert.match(maxkbConfig, /entry:\s*''/)
  assert.match(brandConfig, /entry:\s*''/)
})
