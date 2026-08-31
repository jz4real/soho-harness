#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const maxkbUrl = process.env.MAXKB_BASE_URL || 'http://127.0.0.1:8080'
const port = process.env.DSH_WEB_PORT || '3080'
const accountPath = process.env.MAXKB_ACCOUNT_FILE
const MAXKB_START_TIMEOUT_MS = 30_000
const MAXKB_COMPOSE_STATUS_TIMEOUT_MS = 3_000

async function waitForMaxkb(url) {
  const deadline = Date.now() + MAXKB_START_TIMEOUT_MS
  do {
    const remaining = deadline - Date.now()
    const health = await fetch(`${url.replace(/\/+$/, '')}/`, {
      signal: AbortSignal.timeout(Math.max(1, Math.min(5000, remaining))),
    }).catch(() => null)
    if (health?.ok) return
    if (Date.now() >= deadline) break
    await new Promise(resolve => setTimeout(resolve, 250))
  } while (Date.now() < deadline)
  throw new Error(`MaxKB is not reachable at ${url}. Start MaxKB first.`)
}

function localMaxkbIsManagedByCompose(url) {
  let hostname
  try {
    hostname = new URL(url).hostname
  } catch {
    return true
  }
  if (!['127.0.0.1', '::1', 'localhost'].includes(hostname)) return true
  const result = spawnSync('docker', [
    'compose', '-f', resolve(repoRoot, 'dsh/maxkb/docker-compose.yml'), 'ps', '--format', 'json',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: MAXKB_COMPOSE_STATUS_TIMEOUT_MS })
  const output = result.stdout.trim()
  return result.status !== 0 || (output !== '' && output !== '[]')
}

await waitForMaxkb(maxkbUrl)
if (!localMaxkbIsManagedByCompose(maxkbUrl)) {
  console.warn(`MaxKB responds at ${maxkbUrl}, but is not managed by dsh/maxkb/docker-compose.yml.`)
}

let token = process.env.MAXKB_TOKEN || ''
if (!token && accountPath) {
  await access(accountPath)
  const child = spawn(process.execPath, [resolve(repoRoot, 'dsh/get-maxkb-token.mjs'), accountPath, maxkbUrl], { stdio: ['ignore', 'pipe', 'inherit'] })
  token = await new Promise((resolveToken, reject) => {
    let output = ''
    child.stdout.on('data', data => { output += data })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolveToken(output.trim()) : reject(new Error(`MaxKB token helper exited ${code}`)))
  })
}
if (!token) {
  console.warn('MaxKB authorization is not configured. DSH will start, but MaxKB administration tools require MAXKB_TOKEN or MAXKB_ACCOUNT_FILE.')
}

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const child = spawn(command, ['--dir', repoRoot, 'dsh', 'web', '--port', String(port), '--no-open'], {
  stdio: 'inherit', env: { ...process.env, MAXKB_TOKEN: token, MAXKB_BASE_URL: maxkbUrl },
})
child.on('exit', code => process.exit(code ?? 1))
