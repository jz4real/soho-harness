import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('registers the MaxKB iframe inside the source-owned right workbench', async () => {
  const clientSource = await readFile(new URL('../src/client.js', import.meta.url), 'utf8')

  assert.match(clientSource, /aria-label': 'Soho 右侧工作台'/)
  assert.match(clientSource, /label: 'Files'/)
  assert.match(clientSource, /label: 'MaxKB'/)
  assert.match(clientSource, /iframe/)
  assert.match(clientSource, /--soho-workbench-width/)
  assert.match(clientSource, /margin-right/)
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
