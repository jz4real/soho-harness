// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { ISession, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { SlotTestRuntime, stubSettingsScope, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ComposerAttachment, ComposerAttachmentsOwnerProps, ComposerAttachmentsProps,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import {
  apply as applyConversation, inject as conversationInject,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { ComposerAttachments } from '../src/client/ComposerAttachments.tsx'
import { apply as applyAttachments, inject as attachmentInject } from '../src/client/index.ts'

usePinnedBrowserLanguages('zh-CN')

const SID = 's1' as SessionId

type AppRootProps = PropsRenderSlots<'conversation' | 'details'>
function AppRoot({ renderSlot }: AppRootProps) {
  return <>{renderSlot('conversation', {})}</>
}

async function assembledBench() {
  const runtime = await SlotTestRuntime.create()
  runtime.provide('connection', { api: { settings: {} }, isLoopback: false })
  runtime.provide('remote', { $on: () => () => {} })
  runtime.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  runtime.provide('layout', { openDetails: vi.fn(), closeDetails: vi.fn() })
  const locale = new LocaleRuntime(runtime.ctx)
  runtime.provide('locale', locale)
  runtime.slots.installLocale(locale)
  const prompt = vi.fn<ISession['prompt']>(async () => ({ ok: true, value: { accepted: true } }))
  await runtime.sessions.add({
    id: SID,
    summary: { title: 'S', displayTitle: 'S', cwd: '/proj' },
    session: { prompt, loadOlder: vi.fn<ISession['loadOlder']>() },
  })
  await runtime.root.declare({
    'conversation': { kind: 'single', scope: 'session-maybe' },
    'details': { kind: 'single', scope: 'session' },
  }, AppRoot)
  await runtime.mount({ inject: [...conversationInject], apply: applyConversation })
  await runtime.mount({ inject: [...attachmentInject], apply: applyAttachments })
  return { runtime, prompt, view: runtime.renderRoot() }
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const t = ((key: string, params?: Readonly<Record<string, unknown>>): string => {
  const messages: Record<string, string> = {
    'image.pending': '待发送图片',
    'image.original': '原图',
    'image.preview': '原图预览',
    'image.closePreview': '关闭原图预览',
    'image.openOriginal': '查看原图',
    'image.scrollLeft': '向左滚动图片',
    'image.scrollRight': '向右滚动图片',
    'image.dropBlocked': '当前无法添加图片',
    'image.dropTitle': '图片拖动到此处即可添加',
    'input.send': '发送消息',
  }
  if (key === 'image.remove') {
    const name = params?.name
    return `移除图片 ${typeof name === 'string' ? name : ''}`
  }
  if (key === 'image.dropDesc') {
    const count = params?.count
    const size = params?.size
    return `最多 ${typeof count === 'number' ? String(count) : ''} 张，每张 ${typeof size === 'string' ? size : ''}`
  }
  return messages[key] ?? key
}) as ComposerAttachmentsProps['t']

const enT = ((key: string): string => ({
  'input.send': 'Send message',
  'image.pending': 'Pending images',
  'image.openOriginal': 'View original',
  'image.scrollLeft': 'Scroll images left',
  'image.scrollRight': 'Scroll images right',
  'image.dropDesc': 'Image limits',
}[key] ?? key)) as ComposerAttachmentsProps['t']

function attachment(id: string, name = `${id}.png`): ComposerAttachment {
  return {
    kind: 'image',
    id: id as ComposerAttachment['id'],
    file: new File([Uint8Array.of(1)], name, { type: 'image/png' }),
    previewUrl: `blob:${id}`,
  }
}

function genericAttachment(
  id: string,
  name = `${id}.csv`,
  contents = 'name,score\nAda,10',
): ComposerAttachment {
  return {
    kind: 'file',
    id: id as ComposerAttachment['id'],
    file: new File([contents], name, { type: 'text/csv' }),
    fileType: 'csv',
  }
}

function props(overrides: Partial<ComposerAttachmentsOwnerProps & Pick<ComposerAttachmentsProps, 't'>> = {}): ComposerAttachmentsProps {
  return {
    attachments: [],
    canAcceptDrop: true,
    onAddAttachments: () => {},
    onRemoveAttachment: () => {},
    t,
    ...overrides,
  } as unknown as ComposerAttachmentsProps
}

describe('assembled composer attachment intake', () => {
  it('turns a native-picker CSV into a real card and submitted file prompt part', async () => {
    const { runtime, prompt, view } = await assembledBench()
    try {
      const picker = view.container.querySelector<HTMLInputElement>('input[type="file"]')
      if (picker === null) throw new Error('attachment picker missing')
      const csv = new File(['a,b'], 'scores.csv', { type: 'text/csv' })

      fireEvent.change(picker, { target: { files: [csv] } })
      await waitFor(() => {
        expect(view.getByRole('listitem', {
          name: 'CSV，scores.csv，3 B，已准备发送',
        })).toBeTruthy()
      })

      fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'inspect scores' } })
      fireEvent.click(view.getByRole('button', { name: '发送消息' }))
      await waitFor(() => { expect(prompt).toHaveBeenCalledOnce() })
      expect(prompt).toHaveBeenCalledWith([
        { type: 'file', mediaType: 'text/csv', data: 'YSxi', name: 'scores.csv' },
        { type: 'text', text: 'inspect scores' },
      ], 'queue', expect.any(AbortSignal))
    } finally {
      await runtime.dispose()
    }
  })

  it('turns a document drop into a real draft whose removal excludes it from submit', async () => {
    const { runtime, prompt, view } = await assembledBench()
    try {
      const csv = new File(['x,y'], 'removed.csv', { type: 'text/csv' })
      const dataTransfer = { types: ['Files'], files: [csv], dropEffect: 'none' }

      fireEvent.dragEnter(document.body, { dataTransfer })
      fireEvent.drop(document.body, { dataTransfer })
      await waitFor(() => {
        expect(view.getByRole('listitem', {
          name: 'CSV，removed.csv，3 B，已准备发送',
        })).toBeTruthy()
      })

      fireEvent.click(view.getByRole('button', { name: '移除文件 removed.csv' }))
      await waitFor(() => {
        expect(view.queryByRole('listitem', {
          name: 'CSV，removed.csv，3 B，已准备发送',
        })).toBeNull()
      })
      fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'after removal' } })
      fireEvent.click(view.getByRole('button', { name: '发送消息' }))
      await waitFor(() => { expect(prompt).toHaveBeenCalledOnce() })
      expect(prompt).toHaveBeenCalledWith([
        { type: 'text', text: 'after removal' },
      ], 'queue', expect.any(AbortSignal))
    } finally {
      await runtime.dispose()
    }
  })
})

describe('ComposerAttachments', () => {
  it('accepts file drops anywhere on the document and keeps non-file drags native', () => {
    const onAddAttachments = vi.fn()
    const view = render(<ComposerAttachments {...props({
      onAddAttachments,
      dropLimits: {
        files: { count: 10, size: '20MB', total: '50MB' },
        images: { count: 20, size: '5MB', total: '100MB' },
      },
    })} />)

    expect(fireEvent.dragEnter(document.body, { dataTransfer: null })).toBe(true)
    const textTransfer = { types: ['text/plain'], files: [], dropEffect: 'none' }
    expect(fireEvent.dragEnter(document.body, { dataTransfer: textTransfer })).toBe(true)
    expect(fireEvent.dragOver(document.body, { dataTransfer: textTransfer })).toBe(true)
    expect(fireEvent.drop(document.body, { dataTransfer: textTransfer })).toBe(true)
    expect(view.queryByRole('status')).toBeNull()

    const image = attachment('dropped').file
    const dataTransfer = { types: ['Files'], files: [image], dropEffect: 'none' }
    expect(fireEvent.dragEnter(document.body, { dataTransfer })).toBe(false)
    expect(view.getByRole('status').textContent).toContain('文件或图片拖动到此处即可添加')
    expect(view.getByRole('status').textContent).toContain('文件最多 10 个，单个 20MB，总计 50MB')
    expect(view.getByRole('status').textContent).toContain('图片最多 20 张，单张 5MB，总计 100MB')
    expect(fireEvent.dragOver(document.body, { dataTransfer })).toBe(false)
    expect(dataTransfer.dropEffect).toBe('copy')
    expect(fireEvent.drop(document.body, { dataTransfer })).toBe(false)
    expect(onAddAttachments).toHaveBeenCalledWith([image])
    expect(view.queryByRole('status')).toBeNull()
  })

  it('tracks nested file drags and clears an aborted drag', () => {
    const view = render(<ComposerAttachments {...props()} />)
    const dataTransfer = { types: ['Files'], files: [], dropEffect: 'none' }
    fireEvent.dragLeave(document.body, {
      dataTransfer: { types: ['text/plain'], files: [], dropEffect: 'none' },
    })
    fireEvent.dragEnter(document.body, { dataTransfer })
    fireEvent.dragEnter(document.body, { dataTransfer })
    fireEvent.dragLeave(document.body, { dataTransfer, clientX: 5, clientY: 5 })
    expect(view.getByRole('status')).toBeTruthy()
    fireEvent.dragLeave(document.body, { dataTransfer, clientX: 5, clientY: 5 })
    expect(view.queryByRole('status')).toBeNull()
    fireEvent.dragEnter(document.documentElement, { dataTransfer })
    const leftViewport = new Event('dragleave', { bubbles: true, cancelable: true })
    Object.defineProperties(leftViewport, {
      dataTransfer: { value: dataTransfer },
      clientX: { value: -1 },
      clientY: { value: 5 },
    })
    fireEvent(document.documentElement, leftViewport)
    expect(view.queryByRole('status')).toBeNull()
    fireEvent.dragEnter(document.body, { dataTransfer })
    fireEvent.dragEnd(window, { dataTransfer })
    expect(view.queryByRole('status')).toBeNull()
  })

  it('shows a blocked drop without forwarding its files', () => {
    const onAddAttachments = vi.fn()
    const view = render(<ComposerAttachments {...props({ canAcceptDrop: false, onAddAttachments })} />)
    const image = attachment('blocked').file
    const dataTransfer = { types: ['Files'], files: [image], dropEffect: 'copy' }
    fireEvent.dragEnter(document.body, { dataTransfer })
    expect(view.getByRole('status').textContent).toBe('当前无法添加附件')
    fireEvent.dragOver(document.body, { dataTransfer })
    expect(dataTransfer.dropEffect).toBe('none')
    fireEvent.drop(document.body, { dataTransfer })
    expect(onAddAttachments).not.toHaveBeenCalled()
    expect(view.queryByRole('status')).toBeNull()
  })

  it('routes rail removal and closes previews on Escape or attachment removal', () => {
    const onRemoveAttachment = vi.fn()
    const image = attachment('draft-1', 'pixel.png')
    const initial = props({ attachments: [image], onRemoveAttachment })
    const view = render(<ComposerAttachments {...initial} />)

    fireEvent.click(view.getByRole('button', { name: '移除图片 pixel.png' }))
    expect(onRemoveAttachment).toHaveBeenCalledWith(image.id)
    fireEvent.click(view.getByTitle('查看原图'))
    expect(view.getByRole('dialog', { name: '原图预览' })).toBeTruthy()
    view.rerender(<ComposerAttachments {...props({ attachments: [], onRemoveAttachment })} />)
    expect(view.queryByRole('dialog', { name: '原图预览' })).toBeNull()

    view.rerender(<ComposerAttachments {...initial} />)
    fireEvent.click(view.getByTitle('查看原图'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(view.queryByRole('dialog', { name: '原图预览' })).toBeNull()
  })

  it('labels an unnamed attachment and its original-image preview', () => {
    const image = attachment('unnamed', '')
    const view = render(<ComposerAttachments {...props({ attachments: [image] })} />)
    expect(view.getByAltText('待发送图片')).toBeTruthy()
    fireEvent.click(view.getByTitle('查看原图'))
    expect(view.getByAltText('原图')).toBeTruthy()
  })

  it('renders a generic file as a labeled ready-to-send card', () => {
    const file = genericAttachment('csv', 'scores.csv', '1234567890')
    const view = render(<ComposerAttachments {...props({ attachments: [file] })} />)

    expect(view.getByText('CSV')).toBeTruthy()
    expect(view.getByText('scores.csv')).toBeTruthy()
    expect(view.getByText('10 B')).toBeTruthy()
    expect(view.getByText('已准备发送')).toBeTruthy()
    expect(view.getByRole('button', { name: '移除文件 scores.csv' })).toBeTruthy()
    expect(view.queryByRole('button', { name: '查看原图' })).toBeNull()
  })

  it('routes dropped generic files and card removal through the unified attachment callbacks', () => {
    const onAddAttachments = vi.fn()
    const onRemoveAttachment = vi.fn()
    const file = genericAttachment('report', 'report.csv')
    const view = render(<ComposerAttachments {...props({
      attachments: [file], onAddAttachments, onRemoveAttachment,
    })} />)
    const dataTransfer = { types: ['Files'], files: [file.file], dropEffect: 'none' }

    fireEvent.dragEnter(document.body, { dataTransfer })
    fireEvent.drop(document.body, { dataTransfer })
    expect(onAddAttachments).toHaveBeenCalledWith([file.file])

    fireEvent.click(view.getByRole('button', { name: '移除文件 report.csv' }))
    expect(onRemoveAttachment).toHaveBeenCalledWith(file.id)
  })

  it('switches the deterministic card-layout contract across the 520px boundary', () => {
    let resize: ResizeObserverCallback | undefined
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    })
    const one = genericAttachment('one')
    const two = genericAttachment('two')
    Object.defineProperty(one.file, 'size', { value: 1024 })
    Object.defineProperty(two.file, 'size', { value: 1536 })
    const view = render(<ComposerAttachments {...props({
      attachments: [one, two],
    })} />)
    expect(view.getByRole('list', { name: '待发送文件' })).toBeTruthy()
    expect(view.getAllByRole('listitem')).toHaveLength(2)
    expect(view.getByText('1 KB')).toBeTruthy()
    expect(view.getByText('1.5 KB')).toBeTruthy()
    const layout = view.container.querySelector<HTMLElement>('[data-file-columns]')
    expect(layout?.dataset.fileColumns).toBe('2')
    if (layout === null || resize === undefined) throw new Error('responsive card observer missing')

    act(() => {
      resize?.([{ target: layout, contentRect: { width: 500 } } as unknown as ResizeObserverEntry], {} as ResizeObserver)
    })
    expect(layout.dataset.fileColumns).toBe('1')

    act(() => {
      resize?.([{ target: layout, contentRect: { width: 600 } } as unknown as ResizeObserverEntry], {} as ResizeObserver)
    })
    expect(layout.dataset.fileColumns).toBe('2')
  })

  it('localizes file-card and drop affordances in English', () => {
    const file = genericAttachment('unnamed', '')
    Object.defineProperty(file.file, 'size', { value: 1024 * 1024 })
    const view = render(<ComposerAttachments {...props({ attachments: [file], t: enT })} />)

    expect(view.getByRole('list', { name: 'Files ready to send' })).toBeTruthy()
    expect(view.getByRole('listitem', {
      name: 'CSV, Unnamed file, 1 MB, Ready to send',
    })).toBeTruthy()
    expect(view.getByText('Unnamed file')).toBeTruthy()
    expect(view.getByText('1 MB')).toBeTruthy()
    expect(view.getByText('Ready to send')).toBeTruthy()
    expect(view.getByRole('button', { name: 'Remove file Unnamed file' })).toBeTruthy()

    const dataTransfer = { types: ['Files'], files: [file.file], dropEffect: 'none' }
    fireEvent.dragEnter(document.body, { dataTransfer })
    expect(view.getByRole('status').textContent).toContain('Drop files or images here to add them')
    view.rerender(<ComposerAttachments {...props({ attachments: [file], canAcceptDrop: false, t: enT })} />)
    expect(view.getByRole('status').textContent).toBe('Attachments cannot be added right now')
  })
})
