/** Local, bounded text extraction for generic file attachments. */

import { inflateRawSync } from 'node:zlib'
import type { SaveFileAttachment } from '@deepseek-ai/dsh-attachment'

/** Maximum Unicode code points returned for one extracted file. */
export const MAX_EXTRACTED_FILE_TEXT_CODE_POINTS = 60_000

export interface ExtractedFileText {
  text: string
  truncated: boolean
  status: 'ready' | 'unavailable'
}

interface ZipEntry {
  method: number
  compressed: Uint8Array
  uncompressedSize: number
}

function readUint16(data: Uint8Array, offset: number): number {
  if (offset + 2 > data.byteLength) throw new Error('Truncated ZIP field.')
  return (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8)
}

function readUint32(data: Uint8Array, offset: number): number {
  if (offset + 4 > data.byteLength) throw new Error('Truncated ZIP field.')
  return ((data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8) | ((data[offset + 2] ?? 0) << 16) | ((data[offset + 3] ?? 0) << 24)) >>> 0
}

function decodeUtf8(data: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(data)
}

function readZipEntries(data: Uint8Array): Map<string, ZipEntry> {
  let end = -1
  for (let offset = data.byteLength - 22; offset >= Math.max(0, data.byteLength - 65_557); offset -= 1) {
    if (readUint32(data, offset) === 0x06054b50) {
      end = offset
      break
    }
  }
  if (end < 0) throw new Error('ZIP directory is missing.')
  const count = readUint16(data, end + 10)
  const size = readUint32(data, end + 12)
  let offset = readUint32(data, end + 16)
  if (offset + size > end) throw new Error('ZIP central directory is invalid.')
  const entries = new Map<string, ZipEntry>()
  for (let index = 0; index < count; index += 1) {
    if (readUint32(data, offset) !== 0x02014b50) throw new Error('ZIP entry is invalid.')
    const method = readUint16(data, offset + 10)
    const compressedSize = readUint32(data, offset + 20)
    const uncompressedSize = readUint32(data, offset + 24)
    const nameLength = readUint16(data, offset + 28)
    const extraLength = readUint16(data, offset + 30)
    const commentLength = readUint16(data, offset + 32)
    const localOffset = readUint32(data, offset + 42)
    const name = decodeUtf8(data.subarray(offset + 46, offset + 46 + nameLength))
    if (readUint32(data, localOffset) !== 0x04034b50) throw new Error('ZIP local entry is invalid.')
    const localNameLength = readUint16(data, localOffset + 26)
    const localExtraLength = readUint16(data, localOffset + 28)
    const start = localOffset + 30 + localNameLength + localExtraLength
    const finish = start + compressedSize
    if (finish > data.byteLength) throw new Error('ZIP entry data is truncated.')
    entries.set(name, { method, compressed: data.subarray(start, finish), uncompressedSize })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

function unzipText(entry: ZipEntry): string {
  const data = entry.method === 0
    ? entry.compressed
    : entry.method === 8
      ? new Uint8Array(inflateRawSync(entry.compressed))
      : (() => { throw new Error('Unsupported ZIP compression.') })()
  if (data.byteLength !== entry.uncompressedSize) throw new Error('ZIP entry length is invalid.')
  return decodeUtf8(data)
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function xmlTagText(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'g'))]
    .map(match => decodeXmlText((match[1] ?? '').replace(/<[^>]+>/g, '')))
}

function extractDocx(data: Uint8Array): string {
  const entry = readZipEntries(data).get('word/document.xml')
  if (entry === undefined) throw new Error('DOCX document XML is missing.')
  const xml = unzipText(entry)
  if (!xml.includes('<w:document')) throw new Error('DOCX document XML is invalid.')
  return xmlTagText(xml, 'w:t').join('')
}

function extractXlsx(data: Uint8Array): string {
  const entries = readZipEntries(data)
  if (![...entries.keys()].some(name => name.startsWith('xl/worksheets/'))) throw new Error('XLSX worksheet XML is missing.')
  const text: string[] = []
  for (const [name, entry] of entries) {
    if (name === 'xl/sharedStrings.xml' || name.startsWith('xl/worksheets/')) text.push(...xmlTagText(unzipText(entry), 't'))
  }
  return text.join('\n')
}

function unescapePdfString(value: string): string {
  return value.replace(/\\([\\()nrtbf])/g, (_all, escaped: string) => ({
    n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '(': '(', ')': ')',
  })[escaped] ?? escaped)
}

function extractPdf(data: Uint8Array): string {
  const source = new TextDecoder('latin1').decode(data)
  if (!source.startsWith('%PDF-') || !source.includes('%%EOF') || !/\b\d+\s+\d+\s+obj\b/.test(source)) {
    throw new Error('PDF structure is invalid.')
  }
  const streams: string[] = [source]
  for (const match of source.matchAll(/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const dictionary = match[1] ?? ''
    const bytes = match[2] ?? ''
    if (!dictionary.includes('/FlateDecode')) continue
    streams.push(new TextDecoder('latin1').decode(inflateRawSync(Buffer.from(bytes, 'latin1'))))
  }
  const values: string[] = []
  for (const stream of streams) {
    for (const match of stream.matchAll(/\((?:\\.|[^\\()])*\)\s*Tj\b/g)) values.push(unescapePdfString(match[0].replace(/\)\s*Tj\b/, '').slice(1)))
    for (const match of stream.matchAll(/\[([\s\S]*?)\]\s*TJ\b/g)) {
      for (const literal of (match[1] ?? '').matchAll(/\((?:\\.|[^\\()])*\)/g)) values.push(unescapePdfString(literal[0].slice(1, -1)))
    }
  }
  return values.join('')
}

function fileKind(input: SaveFileAttachment): 'text' | 'docx' | 'xlsx' | 'pdf' | undefined {
  const name = input.name?.toLowerCase()
  if (name?.endsWith('.docx')) return 'docx'
  if (name?.endsWith('.xlsx')) return 'xlsx'
  if (name?.endsWith('.pdf') || input.mediaType === 'application/pdf') return 'pdf'
  if (name?.match(/\.(csv|json|md|markdown|txt)$/) || input.mediaType?.startsWith('text/') || input.mediaType === 'application/json') return 'text'
  return undefined
}

function truncateText(text: string): Pick<ExtractedFileText, 'text' | 'truncated'> {
  const codePoints: string[] = []
  for (const codePoint of text) {
    if (codePoints.length === MAX_EXTRACTED_FILE_TEXT_CODE_POINTS) return { text: codePoints.join(''), truncated: true }
    codePoints.push(codePoint)
  }
  return { text, truncated: false }
}

function extractLocalFileText(input: SaveFileAttachment): ExtractedFileText {
  try {
    const kind = fileKind(input)
    const text = kind === 'text'
      ? decodeUtf8(input.data)
      : kind === 'docx'
        ? extractDocx(input.data)
        : kind === 'xlsx'
          ? extractXlsx(input.data)
          : kind === 'pdf'
            ? extractPdf(input.data)
            : undefined
    if (text === undefined) return { text: '', truncated: false, status: 'unavailable' }
    return { ...truncateText(text), status: 'ready' }
  } catch {
    return { text: '', truncated: false, status: 'unavailable' }
  }
}

/** Extract local text from supported files without network or model calls. */
export function extractFileText(input: SaveFileAttachment): Promise<ExtractedFileText> {
  return Promise.resolve(extractLocalFileText(input))
}
