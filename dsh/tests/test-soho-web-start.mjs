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
await writeFile(join(bin, 'docker'), '#!/bin/sh\nif [ -n "$SOHO_TEST_DOCKER_DELAY" ]; then exec sleep "$SOHO_TEST_DOCKER_DELAY"; fi\nprintf "[]"\n')
await chmod(join(bin, 'pnpm'), 0o755)
await chmod(join(bin, 'docker'), 0o755)

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

const delayedServer = http.createServer((_request, response) => response.end('ok'))
await new Promise(resolve => delayedServer.listen(0, '127.0.0.1', resolve))
const delayedPort = delayedServer.address().port
await new Promise(resolve => delayedServer.close(resolve))

const delayedOutput = join(tmp, 'delayed-launcher-env.json')
const ready = new Promise(resolve => {
  setTimeout(() => delayedServer.listen(delayedPort, '127.0.0.1', resolve), 250)
})
const delayedChild = spawn(process.execPath, [join(root, 'dsh/start-soho-web.mjs')], {
  env: {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    MAXKB_BASE_URL: `http://127.0.0.1:${delayedPort}`,
    SOHO_TEST_OUTPUT: delayedOutput,
  },
})
const delayedExitCode = await new Promise(resolve => delayedChild.on('exit', resolve))
await ready
await new Promise(resolve => delayedServer.close(resolve))

assert.equal(delayedExitCode, 0)
assert.equal(await readFile(delayedOutput, 'utf8'), '')

const statusServer = http.createServer((_request, response) => response.end('ok'))
await new Promise(resolve => statusServer.listen(0, '127.0.0.1', resolve))
const statusPort = statusServer.address().port
const statusOutput = join(tmp, 'status-launcher-env.json')
const statusChild = spawn(process.execPath, [join(root, 'dsh/start-soho-web.mjs')], {
  env: {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    MAXKB_BASE_URL: `http://127.0.0.1:${statusPort}`,
    SOHO_TEST_OUTPUT: statusOutput,
  },
  stdio: ['ignore', 'ignore', 'pipe'],
})
let statusStderr = ''
statusChild.stderr.on('data', data => { statusStderr += data })
const statusExitCode = await new Promise(resolve => statusChild.on('exit', resolve))
await new Promise(resolve => statusServer.close(resolve))

assert.equal(statusExitCode, 0)
assert.match(statusStderr, /not managed by dsh\/maxkb\/docker-compose\.yml/)

const timeoutServer = http.createServer((_request, response) => response.end('ok'))
await new Promise(resolve => timeoutServer.listen(0, '127.0.0.1', resolve))
const timeoutPort = timeoutServer.address().port
const timeoutOutput = join(tmp, 'timeout-launcher-env.json')
const timeoutStarted = Date.now()
const timeoutChild = spawn(process.execPath, [join(root, 'dsh/start-soho-web.mjs')], {
  env: {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    MAXKB_BASE_URL: `http://127.0.0.1:${timeoutPort}`,
    SOHO_TEST_OUTPUT: timeoutOutput,
    SOHO_TEST_DOCKER_DELAY: '5',
  },
})
const timeoutExitCode = await new Promise(resolve => timeoutChild.on('exit', resolve))
await new Promise(resolve => timeoutServer.close(resolve))

assert.equal(timeoutExitCode, 0)
assert(Date.now() - timeoutStarted < 4_000)
