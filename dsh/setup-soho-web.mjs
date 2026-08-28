#!/usr/bin/env node
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
const profile = process.env.DSH_PROFILE || 'web'
const profileDir = join(dshHome, 'profiles', profile)
const manifestPath = join(profileDir, 'package.json')
const patchPath = join(profileDir, 'cordis.patch.yml')
const presetRoot = join(dshHome, '.agent-presets', 'maxkb-builder')
const builtinSkillsRoot = join(repoRoot, 'dsh', 'builtin-skills')
const skillsRoot = join(dshHome, 'skills')

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')) } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

async function readText(path) {
  try { return await readFile(path, 'utf8') } catch (error) {
    if (error.code === 'ENOENT') return ''
    throw error
  }
}

await mkdir(profileDir, { recursive: true })
const manifest = await readJson(manifestPath, {
  name: `dsh-profile-${profile}`, private: true, dependencies: {},
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } },
})
manifest.dependencies ??= {}
for (const retiredPackage of ['dsh-dify', 'dsh-dify-panel', 'dsh-dify-sidebar']) {
  delete manifest.dependencies[retiredPackage]
}
// These packages must remain live links rather than pnpm `file:` snapshots.  The
// profile lives outside the repository, so the absolute link target is per-user
// runtime state and is never committed.  This keeps Git updates visible on both
// macOS and Windows without copying source code or credentials into the profile.
manifest.dependencies['@soho/dsh-brand-plugin'] = `link:${join(repoRoot, 'packages/extensions/soho-brand')}`
manifest.dependencies['@soho/dsh-maxkb'] = `link:${join(repoRoot, 'packages/extensions/maxkb')}`
manifest.dependencies['@soho/dsh-maxkb-panel'] = `link:${join(repoRoot, 'packages/extensions/maxkb-panel')}`
manifest.dsh ??= {}; manifest.dsh.profile ??= {}; manifest.dsh.profile.bundles ??= ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']
manifest.dsh.profile.bundles = manifest.dsh.profile.bundles.filter(name => !name.startsWith('dsh-dify'))
if (!manifest.dsh.profile.bundles.includes('@soho/dsh-maxkb-panel')) manifest.dsh.profile.bundles.push('@soho/dsh-maxkb-panel')
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

let patch = await readText(patchPath)
if (!patch.includes('id: soho-brand')) {
  patch += `${patch.endsWith('\n') || patch === '' ? '' : '\n'}- insert:\n    - id: soho-brand\n      name: '@soho/dsh-brand-plugin'\n`
  await writeFile(patchPath, patch)
}
if (!patch.includes('id: soho-maxkb-tools')) {
  patch += `${patch.endsWith('\n') || patch === '' ? '' : '\n'}- insert:\n    - id: soho-maxkb-tools\n      name: '@soho/dsh-maxkb'\n      config:\n        baseUrl: \"${process.env.MAXKB_BASE_URL || 'http://127.0.0.1:8080'}\"\n        tokenEnv: \"MAXKB_TOKEN\"\n`
  await writeFile(patchPath, patch)
}

try {
  await stat(join(presetRoot, 'agent.cordis.yml'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  await mkdir(presetRoot, { recursive: true })
  await cp(join(repoRoot, 'apps/cli/config/agent-presets/standard/agent.cordis.yml'), join(presetRoot, 'agent.cordis.yml'))
  await writeFile(join(presetRoot, 'preset.yml'), 'name: MaxKB 工作流构建\ndescription: 在本机已授权的 MaxKB 服务中创建、编辑、调试工作流；选择此模式时才打开右侧 MaxKB 工作台。\norder: 21\n')
}

await mkdir(skillsRoot, { recursive: true })
for (const entry of await readdir(builtinSkillsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const target = join(skillsRoot, entry.name)
  try {
    await stat(join(target, 'SKILL.md'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await cp(join(builtinSkillsRoot, entry.name), target, { recursive: true })
  }
}

console.log(`Prepared profile ${profile} at ${profileDir}`)
console.log(`Prepared MaxKB preset at ${presetRoot}`)
console.log(`Prepared built-in skills at ${skillsRoot}`)
