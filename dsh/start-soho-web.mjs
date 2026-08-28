#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const maxkbUrl = process.env.MAXKB_BASE_URL || 'http://127.0.0.1:8080'
const port = process.env.DSH_WEB_PORT || '3080'
const accountPath = process.env.MAXKB_ACCOUNT_FILE

const health = await fetch(`${maxkbUrl.replace(/\/+$/, '')}/`, { signal: AbortSignal.timeout(5000) }).catch(() => null)
if (!health?.ok) throw new Error(`MaxKB is not reachable at ${maxkbUrl}. Start MaxKB first.`)

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
