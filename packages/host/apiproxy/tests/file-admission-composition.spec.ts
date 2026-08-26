import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import LocalAttachmentStore from '@deepseek-ai/dsh-attachment-local'
import LlmRuntime, { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { serializeRequest } from '@deepseek-ai/dsh-llm-deepseek/src/serialize.ts'
import SessionStore, { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import type { RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '../src/api-proxy.ts'

let root: string | undefined
let context: Context | undefined
afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

class ProviderBoundaryAdapter extends LlmAdapter {
  options: GenerateOptions | undefined
  body: ReturnType<typeof serializeRequest> | undefined

  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.options = options
    this.body = serializeRequest(options)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: 'done' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'done' } }
    yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 1 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId('composed-file-admission'), payload }
}

describe('composed file admission boundary', () => {
  it('persists admission and replays the durable event into a keyless provider request', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-file-admission-composition-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-llm'",
      "- name: '@deepseek-ai/dsh-session'",
      "- name: '@deepseek-ai/dsh-system-prompt'",
      "- name: '@deepseek-ai/dsh-tools'",
      "- name: '@deepseek-ai/dsh-agent'",
      "- name: '@deepseek-ai/dsh-user-questions'",
      "- name: '@deepseek-ai/dsh-attachment-local'",
      '  config:',
      `    dshHome: ${JSON.stringify(join(root, 'home'))}`,
      "- name: '@deepseek-ai/dsh-agent-loop'",
      '  config:',
      '    agents: []',
      "- name: '@deepseek-ai/dsh-session-persistence-jsonl'",
      '  config:',
      `    root: ${JSON.stringify(join(root, 'sessions'))}`,
      '',
    ].join('\n'))
    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-llm', LlmRuntime],
      ['@deepseek-ai/dsh-session', SessionStore],
      ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
      ['@deepseek-ai/dsh-tools', ToolRuntime],
      ['@deepseek-ai/dsh-agent', AgentRegistry],
      ['@deepseek-ai/dsh-user-questions', UserQuestionService],
      ['@deepseek-ai/dsh-attachment-local', LocalAttachmentStore],
      ['@deepseek-ai/dsh-agent-loop', AgentLoop],
      ['@deepseek-ai/dsh-session-persistence-jsonl', JsonlSessionPersistence],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()
    const ctx = context
    const adapter = new ProviderBoundaryAdapter()
    ctx.llm.registerAdapter(['capture'], adapter)
    const sessionId = SessionId('composed-file-admission')
    const agent = ctx.agentLoop.create(sessionId, { provider: 'capture', model: 'capture-model' })
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'capture', model: 'capture-model' }),
      cwd: '/tmp',
    })
    const bytes = Buffer.from('alpha,beta\n1,2\n')
    const base64 = bytes.toString('base64')

    await expect(api.sessions.prompt(request({
      sessionId,
      mode: 'queue' as const,
      content: [
        { type: 'text' as const, text: 'Inspect: ' },
        { type: 'file' as const, mediaType: 'text/csv', data: base64, name: 'table.csv' },
      ],
    }))).resolves.toMatchObject({ result: { ok: true } })
    await agent.whenIdle()
    await ctx.sessions.flush(agent.session)

    const loaded = await ctx.sessionPersistence.load(sessionId)
    const userIndex = loaded.events.findIndex(event => event.type === 'user/message')
    expect(userIndex).toBeGreaterThanOrEqual(0)
    const persistedUser = loaded.events[userIndex] as SessionEvent<'user/message'>
    const file = persistedUser.data.content.find(block => block.type === 'file')
    expect(file?.type).toBe('file')
    if (file?.type !== 'file') throw new Error('persisted file block missing')
    const stored = await ctx.attachments.readFile(file.attachment)

    const replay = Session.create(
      SessionId('durable-file-replay'),
      structuredClone(loaded.events.slice(0, userIndex + 1)),
    )
    const replayed = replay.deriveMessages()
    if (adapter.options === undefined || adapter.body === undefined) throw new Error('provider request was not captured')
    const replayBody = serializeRequest({ ...adapter.options, messages: replayed })

    expect(replayBody.messages).toEqual(adapter.body.messages)
    expect(JSON.stringify({ persistedUser, replayed, provider: adapter.body })).not.toContain(base64)
    expect({
      persistedContent: persistedUser.data.content.map(block => block.type === 'file'
        ? { ...block, attachment: { ...block.attachment, attachmentId: '<content-addressed>' } }
        : block),
      replayedContent: replayed[0]?.content.map(block => block.type === 'file'
        ? { ...block, attachment: { ...block.attachment, attachmentId: '<content-addressed>' } }
        : block),
      storedText: Buffer.from(stored.data).toString('utf8'),
      providerMessages: adapter.body.messages,
    }).toMatchInlineSnapshot(`
      {
        "persistedContent": [
          {
            "text": "Inspect: ",
            "type": "text",
          },
          {
            "attachment": {
              "attachmentId": "<content-addressed>",
              "bytes": 15,
              "mediaType": "text/csv",
              "name": "table.csv",
            },
            "type": "file",
          },
          {
            "text": "[File: table.csv]
      alpha,beta
      1,2
      ",
            "type": "text",
          },
        ],
        "providerMessages": [
          {
            "content": "You are an AI agent powered by DeepSeek Harness.",
            "role": "system",
          },
          {
            "content": "Inspect: [File: table.csv]
      alpha,beta
      1,2
      ",
            "role": "user",
          },
        ],
        "replayedContent": [
          {
            "text": "Inspect: ",
            "type": "text",
          },
          {
            "attachment": {
              "attachmentId": "<content-addressed>",
              "bytes": 15,
              "mediaType": "text/csv",
              "name": "table.csv",
            },
            "type": "file",
          },
          {
            "text": "[File: table.csv]
      alpha,beta
      1,2
      ",
            "type": "text",
          },
        ],
        "storedText": "alpha,beta
      1,2
      ",
      }
    `)
  })
})
