import { describe, expect, it } from 'vitest'
import { extractedFileContexts } from '../src/file-context.ts'

const TRUNCATED = '[Local text extraction truncated.]'

function codePoints(value: string): number {
  return Array.from(value).length
}

describe('extractedFileContexts', () => {
  it('uses a tiny complete-value budget for the header and truthful notice', () => {
    const expected = `[File: a]\n${TRUNCATED}`
    expect(extractedFileContexts([{
      name: 'a',
      extracted: { status: 'ready', text: '😀x'.repeat(100), truncated: false },
    }], codePoints(expected))).toEqual([expected])
  })

  it('keeps an exact-bound Unicode value without adding a notice', () => {
    const expected = '[File: 文😀.txt]\n甲😀'
    expect(extractedFileContexts([{
      name: '文😀.txt',
      extracted: { status: 'ready', text: '甲😀', truncated: false },
    }], codePoints(expected))).toEqual([expected])
  })

  it('reserves complete Unicode wrappers for every later file', () => {
    const expected = [
      `[File: 一😀.txt]\n${TRUNCATED}`,
      '[File: 二.txt]\n[Local text extraction unavailable; file contents were not read.]',
      '[File: 三.txt]\n😀甲',
    ]
    const limit = expected.reduce((total, value) => total + codePoints(value), 0)
    const actual = extractedFileContexts([
      { name: '一😀.txt', extracted: { status: 'ready', text: '甲'.repeat(200), truncated: false } },
      { name: '二.txt', extracted: { status: 'unavailable' } },
      { name: '三.txt', extracted: { status: 'ready', text: '😀甲', truncated: false } },
    ], limit)
    expect(actual).toEqual(expected)
    expect(actual.reduce((total, value) => total + codePoints(value), 0)).toBe(limit)
  })
})
