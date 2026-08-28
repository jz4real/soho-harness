import assert from 'node:assert/strict'
import http from 'node:http'
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('../..', import.meta.url)))
const tmp = await mkdtemp(join(tmpdir(), 'soho-web-start-'))
const bin = join(tmp, 'bin')
const output = join(tmp, 'launcher-env.json')
await mkdir(bin)
await writeFile(join(bin, 'pnpm'), `#!/bin/sh\nprintf '%s' \"$MAXKB_TOKEN\" > \"$SOHO_TEST_OUTPUT\"\n`)
await chmod(join(bin, 'pnpm'), 0o755)

const server = http.createServer((_request, response) => response.end('ok'))
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()

const child = spawn(process.execPath, [join(root, 'dsh/start-soho-web.mjs')], {
  env: {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    MAXKB_BASE_URL: `http://127.0.0.1:${port}`,
    SOHO_TEST_OUTPUT: output,
  },
})
const exitCode = await new Promise(resolve => child.on('exit', resolve))
server.close()

assert.equal(exitCode, 0)
assert.equal(await readFile(output, 'utf8'), '')
