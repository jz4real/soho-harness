#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const args = Object.fromEntries(process.argv.slice(2).flatMap((value, index, values) => value.startsWith('--') && values[index + 1] && !values[index + 1].startsWith('--') ? [[value, values[index + 1]]] : []))
if (process.argv.includes('--help')) {
  console.log('Usage: migrate-maxkb-volumes.mjs --source-data VOLUME --source-postgres VOLUME --target-data VOLUME --target-postgres VOLUME [--apply]')
  console.log('Without --apply this validates and prints the two Docker copy commands. Stop both MaxKB containers first.')
  process.exit(0)
}
const required = ['--source-data', '--source-postgres', '--target-data', '--target-postgres']
if (required.some(key => !args[key])) throw new Error(`Missing required option: ${required.find(key => !args[key])}`)
const copies = [
  [args['--source-data'], args['--target-data']],
  [args['--source-postgres'], args['--target-postgres']],
]
const copyCommand = ([source, target]) => ['run', '--rm', '-v', `${source}:/from:ro`, '-v', `${target}:/to`, 'alpine:3.20', 'sh', '-ec', 'cd /from && tar cf - . | tar xf - -C /to']
for (const pair of copies) console.log(`docker ${copyCommand(pair).map(part => JSON.stringify(part)).join(' ')}`)
if (!process.argv.includes('--apply')) process.exit(0)
for (const pair of copies) {
  const result = spawnSync('docker', copyCommand(pair), { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}
