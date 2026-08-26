import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AttachmentStore from '@deepseek-ai/dsh-attachment'
import type { FileAttachmentRef, ImageAttachmentRef, SaveFileAttachment, SaveImageAttachment } from '@deepseek-ai/dsh-attachment'
import SessionStore from '@deepseek-ai/dsh-session'
import type { SessionId, UserMessage } from '@deepseek-ai/dsh-session'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import type { RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { sessionPromptRequestSchema } from '../src/api/sessions.schema.ts'
import { createApiProxy } from '../src/api-proxy.ts'

let nextRpc = 1
function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`attachments-${String(nextRpc++)}`), payload }
}

function fileRef(input: SaveFileAttachment, index: number): FileAttachmentRef {
  return {
    attachmentId: `file-${String(index)}` as FileAttachmentRef['attachmentId'],
    mediaType: input.mediaType ?? 'application/octet-stream',
    bytes: input.data.byteLength,
    ...input.name === undefined ? {} : { name: input.name },
  }
}

async function harness(): Promise<{
  ctx: Context
  sessionId: SessionId
  followup: ReturnType<typeof vi.fn>
  saveFiles: ReturnType<typeof vi.fn>
}> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(AgentRegistry)
  const session = ctx.sessions.create()
  const followup = vi.fn()
  const agent = {
    id: session.id,
    session,
    status: 'idle',
    ctx,
    inbox: { nextTurn: [], nextStep: [] },
    followup,
  } as unknown as Agent
  ctx.agents.register(agent)

  const saveFiles = vi.fn((inputs: readonly SaveFileAttachment[]) => (
    Promise.resolve(inputs.map(fileRef))
  ))
  const saveImages = vi.fn((inputs: readonly SaveImageAttachment[]) => Promise.resolve(inputs.map((input, index) => ({
    attachmentId: `image-${String(index)}` as ImageAttachmentRef['attachmentId'],
    mediaType: input.mediaType,
    bytes: input.data.byteLength,
    width: 1,
    height: 1,
    ...input.name === undefined ? {} : { name: input.name },
  } satisfies ImageAttachmentRef))))
  ctx.provide('attachments', Object.setPrototypeOf({ saveFiles, saveImages }, AttachmentStore.prototype) as AttachmentStore)
  ctx.provide('llm', {
    listProviders: () => [{ id: 'test', name: 'Test' }],
    resolveModelInfo: (provider: string, model: string) => Promise.resolve({
      provider,
      id: model,
      name: model,
      inputModalities: ['text', 'image'],
    }),
  } as never)
  return { ctx, sessionId: session.id, followup, saveFiles }
}

describe('session prompt file admission', () => {
  it('accepts the file wire part and persists its reference immediately before filename-tagged local text', async () => {
    const { ctx, sessionId, followup, saveFiles } = await harness()
    const data = Buffer.from('city,total\nShanghai,42\n').toString('base64')
    expect(sessionPromptRequestSchema.parse({
      sessionId,
      mode: 'queue',
      content: [{ type: 'file', mediaType: 'text/csv', data, name: 'report.csv' }],
    }).content[0]).toEqual({ type: 'file', mediaType: 'text/csv', data, name: 'report.csv' })
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'test', model: 'model' }),
      cwd: '/tmp',
    })

    await expect(api.sessions.prompt(request({
      sessionId,
      mode: 'queue' as const,
      content: [
        { type: 'text' as const, text: 'Summarize: ' },
        { type: 'file' as const, mediaType: 'text/csv', data, name: 'report.csv' },
      ],
    }))).resolves.toMatchObject({ result: { ok: true } })

    expect(saveFiles.mock.calls[0]?.[0]).toEqual([{
      data: new Uint8Array(Buffer.from(data, 'base64')),
      mediaType: 'text/csv',
      name: 'report.csv',
    }])
    expect((followup.mock.calls[0]?.[0] as UserMessage).content).toEqual([
      { type: 'text', text: 'Summarize: ' },
      {
        type: 'file',
        attachment: { attachmentId: 'file-0', mediaType: 'text/csv', bytes: 23, name: 'report.csv' },
      },
      { type: 'text', text: '[File: report.csv]\ncity,total\nShanghai,42\n' },
    ])
    await ctx.fiber.dispose()
  })

  it('keeps mixed text, image, and expanded file content in submission order', async () => {
    const { ctx, sessionId, followup } = await harness()
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'test', model: 'model' }),
      cwd: '/tmp',
    })

    await expect(api.sessions.prompt(request({
      sessionId,
      mode: 'queue' as const,
      content: [
        { type: 'text' as const, text: 'before' },
        { type: 'image' as const, mediaType: 'image/png' as const, data: 'AQ==', name: 'pixel.png' },
        { type: 'file' as const, mediaType: 'text/plain', data: 'bG9jYWw=', name: 'note.txt' },
        { type: 'text' as const, text: 'after' },
      ],
    }))).resolves.toMatchObject({ result: { ok: true } })

    expect((followup.mock.calls[0]?.[0] as UserMessage).content).toEqual([
      { type: 'text', text: 'before' },
      {
        type: 'image',
        attachment: { attachmentId: 'image-0', mediaType: 'image/png', bytes: 1, width: 1, height: 1, name: 'pixel.png' },
      },
      {
        type: 'file',
        attachment: { attachmentId: 'file-0', mediaType: 'text/plain', bytes: 5, name: 'note.txt' },
      },
      { type: 'text', text: '[File: note.txt]\nlocal' },
      { type: 'text', text: 'after' },
    ])
    await ctx.fiber.dispose()
  })

  it('states that local extraction was unavailable without claiming corrupt contents were read', async () => {
    const { ctx, sessionId, followup } = await harness()
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'test', model: 'model' }),
      cwd: '/tmp',
    })

    await expect(api.sessions.prompt(request({
      sessionId,
      mode: 'queue' as const,
      content: [{
        type: 'file' as const,
        mediaType: 'application/pdf',
        data: Buffer.from('not a valid PDF').toString('base64'),
        name: 'broken.pdf',
      }],
    }))).resolves.toMatchObject({ result: { ok: true } })

    expect((followup.mock.calls[0]?.[0] as UserMessage).content).toEqual([
      {
        type: 'file',
        attachment: { attachmentId: 'file-0', mediaType: 'application/pdf', bytes: 15, name: 'broken.pdf' },
      },
      {
        type: 'text',
        text: '[File: broken.pdf]\n[Local text extraction unavailable; file contents were not read.]',
      },
    ])
    await ctx.fiber.dispose()
  })

  it('persists a zero-byte file from its canonical empty encoding', async () => {
    const { ctx, sessionId, followup, saveFiles } = await harness()
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'test', model: 'model' }),
      cwd: '/tmp',
    })

    await expect(api.sessions.prompt(request({
      sessionId,
      mode: 'queue' as const,
      content: [{ type: 'file' as const, mediaType: 'text/plain', data: '', name: 'empty.txt' }],
    }))).resolves.toMatchObject({ result: { ok: true } })

    expect(saveFiles).toHaveBeenCalledWith([{
      data: new Uint8Array(), mediaType: 'text/plain', name: 'empty.txt',
    }])
    expect((followup.mock.calls[0]?.[0] as UserMessage).content).toEqual([
      {
        type: 'file',
        attachment: { attachmentId: 'file-0', mediaType: 'text/plain', bytes: 0, name: 'empty.txt' },
      },
      { type: 'text', text: '[File: empty.txt]\n' },
    ])
    await ctx.fiber.dispose()
  })

  it.each(['YQ', 'not-base64!!'])(
    'rejects non-canonical file base64 %j before storage or followup',
    async (data) => {
      const { ctx, sessionId, followup, saveFiles } = await harness()
      const api = createApiProxy(ctx, {
        defaultModelSelection: () => ({ provider: 'test', model: 'model' }),
        cwd: '/tmp',
      })

      const result = await api.sessions.prompt(request({
        sessionId,
        mode: 'queue' as const,
        content: [{ type: 'file' as const, mediaType: 'text/plain', data, name: 'bad.txt' }],
      }))

      expect(result.result).toMatchObject({
        ok: false,
        error: { code: 'attachment-error', details: { reason: 'INVALID_FILE_BASE64' } },
      })
      expect(saveFiles).not.toHaveBeenCalled()
      expect(followup).not.toHaveBeenCalled()
      await ctx.fiber.dispose()
    },
  )

  it('caps the complete emitted Unicode file context at exactly 160,000 code points', async () => {
    const { ctx, sessionId, followup } = await harness()
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'test', model: 'model' }),
      cwd: '/tmp',
    })
    const files = [
      { text: '😀'.repeat(60_000), name: '一😀.txt' },
      { text: '甲'.repeat(60_000), name: '二.txt' },
      { text: '乙'.repeat(60_000), name: '三.txt' },
    ]

    await expect(api.sessions.prompt(request({
      sessionId,
      mode: 'queue' as const,
      content: files.map(file => ({
        type: 'file' as const,
        mediaType: 'text/plain',
        data: Buffer.from(file.text).toString('base64'),
        name: file.name,
      })),
    }))).resolves.toMatchObject({ result: { ok: true } })

    const content = (followup.mock.calls[0]?.[0] as UserMessage).content
    const contexts = content.filter(block => block.type === 'text').map(block => block.text)
    expect(contexts).toHaveLength(3)
    expect(contexts.map(value => value.split('\n', 1)[0])).toEqual([
      '[File: 一😀.txt]', '[File: 二.txt]', '[File: 三.txt]',
    ])
    expect(contexts.reduce((total, value) => total + Array.from(value).length, 0)).toBe(160_000)
    expect(contexts[2]).toMatch(/\n\[Local text extraction truncated\.\]$/)
    await ctx.fiber.dispose()
  })
})
