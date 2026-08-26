/** Local, bounded text extraction for generic file attachments. */

import { inflateRawSync } from 'node:zlib'
import type { SaveFileAttachment } from '@deepseek-ai/dsh-attachment'
import { SaxesParser } from 'saxes'

/** Maximum Unicode code points returned for one extracted file. */
export const MAX_EXTRACTED_FILE_TEXT_CODE_POINTS = 60_000
/** Maximum cumulative bytes materialized from ZIP or compressed PDF streams. */
export const MAX_COMPRESSED_ENTRY_OUTPUT_BYTES = 4 * 1024 * 1024
const MAX_ZIP_ENTRIES = 256

export interface ExtractedFileText {
  text: string
  truncated: boolean
  status: 'ready' | 'unavailable'
}

interface ZipEntry {
  method: number
  compressed: Uint8Array
  uncompressedSize: number
  crc32: number
}

type LimitedText = Pick<ExtractedFileText, 'text' | 'truncated'>

class TextCollector {
  private readonly codePoints: string[] = []
  private _truncated = false
  private _hasVisibleText = false

  get truncated(): boolean {
    return this._truncated
  }

  get hasVisibleText(): boolean {
    return this._hasVisibleText
  }

  append(text: string): void {
    if (this._truncated) return
    for (const codePoint of text) {
      if (this.codePoints.length === MAX_EXTRACTED_FILE_TEXT_CODE_POINTS) {
        this._truncated = true
        return
      }
      if (!/\s/.test(codePoint)) this._hasVisibleText = true
      this.codePoints.push(codePoint)
    }
  }

  result(): LimitedText {
    return { text: this.codePoints.join(''), truncated: this._truncated }
  }
}

class DecompressionBudget {
  private remaining = MAX_COMPRESSED_ENTRY_OUTPUT_BYTES

  reserve(bytes: number): number {
    if (bytes > this.remaining) throw new Error('Compressed file exceeds the local extraction budget.')
    this.remaining -= bytes
    return bytes
  }

  limit(): number {
    if (this.remaining === 0) throw new Error('Compressed file exceeds the local extraction budget.')
    return this.remaining
  }

  consume(bytes: number): void {
    if (bytes > this.remaining) throw new Error('Compressed file exceeds the local extraction budget.')
    this.remaining -= bytes
  }
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

function crc32(data: Uint8Array): number {
  let value = 0xffffffff
  for (const byte of data) {
    value ^= byte
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  }
  return (value ^ 0xffffffff) >>> 0
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
  if (count > MAX_ZIP_ENTRIES) throw new Error('ZIP has too many entries.')
  const size = readUint32(data, end + 12)
  let offset = readUint32(data, end + 16)
  if (offset + size > end) throw new Error('ZIP central directory is invalid.')
  const entries = new Map<string, ZipEntry>()
  for (let index = 0; index < count; index += 1) {
    if (readUint32(data, offset) !== 0x02014b50) throw new Error('ZIP entry is invalid.')
    const method = readUint16(data, offset + 10)
    const checksum = readUint32(data, offset + 16)
    const compressedSize = readUint32(data, offset + 20)
    const uncompressedSize = readUint32(data, offset + 24)
    const nameLength = readUint16(data, offset + 28)
    const extraLength = readUint16(data, offset + 30)
    const commentLength = readUint16(data, offset + 32)
    const localOffset = readUint32(data, offset + 42)
    const name = decodeUtf8(data.subarray(offset + 46, offset + 46 + nameLength))
    if (readUint32(data, localOffset) !== 0x04034b50) throw new Error('ZIP local entry is invalid.')
    if (readUint16(data, localOffset + 8) !== method || readUint32(data, localOffset + 14) !== checksum) {
      throw new Error('ZIP local entry metadata is invalid.')
    }
    const localNameLength = readUint16(data, localOffset + 26)
    const localExtraLength = readUint16(data, localOffset + 28)
    const start = localOffset + 30 + localNameLength + localExtraLength
    const finish = start + compressedSize
    if (finish > data.byteLength) throw new Error('ZIP entry data is truncated.')
    entries.set(name, { method, compressed: data.subarray(start, finish), uncompressedSize, crc32: checksum })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

function unzipText(entry: ZipEntry, budget: DecompressionBudget): string {
  const maxOutputLength = budget.reserve(entry.uncompressedSize)
  const data = entry.method === 0
    ? entry.compressed
    : entry.method === 8
      ? new Uint8Array(inflateRawSync(entry.compressed, { maxOutputLength }))
      : (() => { throw new Error('Unsupported ZIP compression.') })()
  if (data.byteLength !== entry.uncompressedSize || crc32(data) !== entry.crc32) throw new Error('ZIP entry integrity check failed.')
  return decodeUtf8(data)
}

function assertWellFormedXml(xml: string): void {
  new SaxesParser().write(xml).close()
}

function readOfficeEntry(entries: Map<string, ZipEntry>, name: string, budget: DecompressionBudget): string {
  const entry = entries.get(name)
  if (entry === undefined) throw new Error(`Office package entry ${name} is missing.`)
  const xml = unzipText(entry, budget)
  assertWellFormedXml(xml)
  return xml
}

function validateOfficePackage(
  entries: Map<string, ZipEntry>,
  contentType: string,
  target: string,
  budget: DecompressionBudget,
): void {
  const contentTypes = readOfficeEntry(entries, '[Content_Types].xml', budget)
  const rootRelationships = readOfficeEntry(entries, '_rels/.rels', budget)
  if (!contentTypes.includes('<Types') || !contentTypes.includes(contentType)
    || !rootRelationships.includes('<Relationships') || !rootRelationships.includes(target)) {
    throw new Error('Office package structure is invalid.')
  }
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

function appendXmlTagText(xml: string, tag: string, collector: TextCollector): void {
  for (const match of xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'g'))) {
    collector.append(decodeXmlText((match[1] ?? '').replace(/<[^>]+>/g, '')))
    if (collector.truncated) return
  }
}

function extractDocx(data: Uint8Array): LimitedText {
  const entries = readZipEntries(data)
  const budget = new DecompressionBudget()
  validateOfficePackage(entries, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml', 'word/document.xml', budget)
  const xml = readOfficeEntry(entries, 'word/document.xml', budget)
  if (!xml.includes('<w:document')) throw new Error('DOCX document XML is invalid.')
  const collector = new TextCollector()
  appendXmlTagText(xml, 'w:t', collector)
  return collector.result()
}

function extractXlsx(data: Uint8Array): LimitedText {
  const entries = readZipEntries(data)
  const budget = new DecompressionBudget()
  validateOfficePackage(entries, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml', 'xl/workbook.xml', budget)
  const workbook = readOfficeEntry(entries, 'xl/workbook.xml', budget)
  if (!workbook.includes('<workbook')) throw new Error('XLSX workbook XML is invalid.')
  if (![...entries.keys()].some(name => name.startsWith('xl/worksheets/'))) throw new Error('XLSX worksheet XML is missing.')
  const collector = new TextCollector()
  for (const [name, entry] of entries) {
    if (name === 'xl/sharedStrings.xml' || name.startsWith('xl/worksheets/')) appendXmlTagText(unzipText(entry, budget), 't', collector)
    if (collector.truncated) break
  }
  return collector.result()
}

function unescapePdfString(value: string): string {
  return value.replace(/\\([\\()nrtbf])/g, (_all, escaped: string) => ({
    n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '(': '(', ')': ')',
  })[escaped] ?? escaped)
}

function appendPdfText(stream: string, collector: TextCollector): void {
  for (const match of stream.matchAll(/\((?:\\.|[^\\()])*\)\s*Tj\b/g)) {
    collector.append(unescapePdfString(match[0].replace(/\)\s*Tj\b/, '').slice(1)))
    if (collector.truncated) return
  }
  for (const match of stream.matchAll(/\[([\s\S]*?)\]\s*TJ\b/g)) {
    for (const literal of (match[1] ?? '').matchAll(/\((?:\\.|[^\\()])*\)/g)) {
      collector.append(unescapePdfString(literal[0].slice(1, -1)))
      if (collector.truncated) return
    }
  }
}

function validatePdfStructure(source: string): void {
  const trailer = /trailer\s*<<([\s\S]*?)>>\s*startxref\s+(\d+)\s+%%EOF\s*$/.exec(source)
  const root = trailer?.[1] === undefined ? undefined : /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(trailer[1])
  if (!source.startsWith('%PDF-') || trailer === null || root === null || root === undefined) {
    throw new Error('PDF structure is invalid.')
  }
  const xrefOffset = Number(trailer[2])
  if (!Number.isSafeInteger(xrefOffset) || source.slice(xrefOffset, xrefOffset + 4) !== 'xref') {
    throw new Error('PDF xref offset is invalid.')
  }
  const xref = /^xref\s+(\d+)\s+(\d+)\r?\n/.exec(source.slice(xrefOffset))
  if (xref === null) throw new Error('PDF xref is invalid.')
  const firstObject = Number(xref[1])
  const count = Number(xref[2])
  let offset = xrefOffset + xref[0].length
  const objects = new Set<string>()
  for (let index = 0; index < count; index += 1) {
    const entry = /^(\d{10})\s(\d{5})\s([fn])\s*\r?\n/.exec(source.slice(offset))
    if (entry === null) throw new Error('PDF xref entry is invalid.')
    offset += entry[0].length
    if (entry[3] === 'n') {
      const object = firstObject + index
      const generation = Number(entry[2])
      const objectOffset = Number(entry[1])
      if (source.slice(objectOffset, objectOffset + `${object} ${generation} obj`.length) !== `${object} ${generation} obj`) {
        throw new Error('PDF xref points to an invalid object.')
      }
      objects.add(`${object} ${generation}`)
    }
  }
  if (!objects.has(`${root[1]} ${root[2]}`)) throw new Error('PDF root object is invalid.')
}

function extractPdf(data: Uint8Array): LimitedText {
  const source = new TextDecoder('latin1').decode(data)
  validatePdfStructure(source)
  const collector = new TextCollector()
  const budget = new DecompressionBudget()
  appendPdfText(source, collector)
  for (const match of source.matchAll(/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const dictionary = match[1] ?? ''
    const bytes = match[2] ?? ''
    if (!dictionary.includes('/FlateDecode')) continue
    const inflated = new Uint8Array(inflateRawSync(Buffer.from(bytes, 'latin1'), { maxOutputLength: budget.limit() }))
    budget.consume(inflated.byteLength)
    appendPdfText(new TextDecoder('latin1').decode(inflated), collector)
    if (collector.truncated) break
  }
  if (!collector.hasVisibleText) throw new Error('PDF has no visible text.')
  return collector.result()
}

function fileKind(input: SaveFileAttachment): 'text' | 'docx' | 'xlsx' | 'pdf' | undefined {
  const name = input.name?.toLowerCase()
  if (name?.endsWith('.docx') || input.mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (name?.endsWith('.xlsx') || input.mediaType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx'
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
    const result = kind === 'text'
      ? decodeUtf8(input.data)
      : kind === 'docx'
        ? extractDocx(input.data)
        : kind === 'xlsx'
          ? extractXlsx(input.data)
          : kind === 'pdf'
            ? extractPdf(input.data)
            : undefined
    if (result === undefined) return { text: '', truncated: false, status: 'unavailable' }
    return { ...(typeof result === 'string' ? truncateText(result) : result), status: 'ready' }
  } catch {
    return { text: '', truncated: false, status: 'unavailable' }
  }
}

/** Extract local text from supported files without network or model calls. */
export function extractFileText(input: SaveFileAttachment): Promise<ExtractedFileText> {
  return Promise.resolve(extractLocalFileText(input))
}
