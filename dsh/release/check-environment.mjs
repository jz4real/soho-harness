#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const json = process.argv.includes('--json')
const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const probe = (bin, args) => {
  const result = spawnSync(bin, args, { encoding: 'utf8' })
  return { ok: result.status === 0, value: (result.stdout || result.stderr || '').trim().split('\n')[0] }
}
const report = {
  platform: process.platform,
  architecture: process.arch,
  node: process.version,
  pnpm: probe(command, ['--version']),
  docker: probe('docker', ['version', '--format', '{{.Server.Version}}']),
  compose: probe('docker', ['compose', 'version', '--short']),
}
if (json) process.stdout.write(`${JSON.stringify(report)}\n`)
else {
  console.table(report)
  if (!report.pnpm.ok || !report.docker.ok || !report.compose.ok) process.exitCode = 1
}
