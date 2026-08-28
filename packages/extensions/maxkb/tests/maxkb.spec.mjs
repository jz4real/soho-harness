import assert from 'node:assert/strict'
import test from 'node:test'

import { openDebugResult } from '../src/index.js'

test('normalizes MaxKB primitive debug session identifiers into tool objects', async () => {
  const result = await openDebugResult({ openDebug: async () => 'debug-session-1' }, {
    workspaceId: 'default',
    applicationId: 'app-1',
    baseUrl: 'http://127.0.0.1:8080',
  })

  assert.deepEqual(result, {
    ok: true,
    debugSessionId: 'debug-session-1',
    workspaceId: 'default',
    applicationId: 'app-1',
    workflowUrl: 'http://127.0.0.1:8080/admin/application/workspace/app-1/workflow',
  })
})
