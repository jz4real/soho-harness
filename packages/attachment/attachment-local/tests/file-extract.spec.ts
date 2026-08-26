import { describe, expect, it } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { extractFileText, MAX_EXTRACTED_FILE_TEXT_CODE_POINTS } from '../src/file-extract.ts'

const encoder = new TextEncoder()

function crc32(data: Uint8Array): number {
  let value = 0xffffffff
  for (const byte of data) {
    value ^= byte
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  }
  return (value ^ 0xffffffff) >>> 0
}

function writeUint16(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff)
}

function writeUint32(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
}

/** Minimal, stored ZIP fixture with the office XML entries the extractor reads. */
function zip(entries: Record<string, string>, compression: 'store' | 'deflate' = 'store'): Uint8Array {
  const parts: number[] = []
  const central: number[] = []
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name)
    const data = encoder.encode(content)
    const compressed = compression === 'deflate' ? new Uint8Array(deflateRawSync(data)) : data
    const method = compression === 'deflate' ? 8 : 0
    const offset = parts.length
    const checksum = crc32(data)
    writeUint32(parts, 0x04034b50)
    writeUint16(parts, 20)
    writeUint16(parts, 0)
    writeUint16(parts, method)
    writeUint16(parts, 0)
    writeUint16(parts, 0)
    writeUint32(parts, checksum)
    writeUint32(parts, compressed.byteLength)
    writeUint32(parts, data.byteLength)
    writeUint16(parts, nameBytes.byteLength)
    writeUint16(parts, 0)
    parts.push(...nameBytes, ...compressed)

    writeUint32(central, 0x02014b50)
    writeUint16(central, 20)
    writeUint16(central, 20)
    writeUint16(central, 0)
    writeUint16(central, method)
    writeUint16(central, 0)
    writeUint16(central, 0)
    writeUint32(central, checksum)
    writeUint32(central, compressed.byteLength)
    writeUint32(central, data.byteLength)
    writeUint16(central, nameBytes.byteLength)
    writeUint16(central, 0)
    writeUint16(central, 0)
    writeUint16(central, 0)
    writeUint16(central, 0)
    writeUint32(central, 0)
    writeUint32(central, offset)
    central.push(...nameBytes)
  }
  const centralOffset = parts.length
  parts.push(...central)
  writeUint32(parts, 0x06054b50)
  writeUint16(parts, 0)
  writeUint16(parts, 0)
  writeUint16(parts, Object.keys(entries).length)
  writeUint16(parts, Object.keys(entries).length)
  writeUint32(parts, central.length)
  writeUint32(parts, centralOffset)
  writeUint16(parts, 0)
  return Uint8Array.from(parts)
}

const DOCX_CONTENT_TYPES = '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
const XLSX_CONTENT_TYPES = '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>'

function pdf(text: string | undefined, startxrefDelta = 0): Uint8Array {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length 20 >>\nstream\nBT ${text === undefined ? '' : `(${text}) Tj`} ET\nendstream\nendobj\n`,
  ]
  let source = '%PDF-1.4\n'
  const offsets = objects.map((object) => {
    const offset = encoder.encode(source).byteLength
    source += object
    return offset
  })
  const xrefOffset = encoder.encode(source).byteLength
  source += `xref\n0 5\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R >>\nstartxref\n${xrefOffset + startxrefDelta}\n%%EOF`
  return encoder.encode(source)
}

function replaceFirst(data: Uint8Array, from: string, to: string): Uint8Array {
  const needle = encoder.encode(from)
  const replacement = encoder.encode(to)
  const copy = Uint8Array.from(data)
  for (let index = 0; index <= copy.byteLength - needle.byteLength; index += 1) {
    if (needle.every((byte, offset) => copy[index + offset] === byte)) {
      copy.set(replacement, index)
      return copy
    }
  }
  throw new Error(`Could not find ${from} in fixture.`)
}

describe('local file text extraction', () => {
  it('returns readable CSV and UTF-8 text', async () => {
    await expect(extractFileText({
      data: encoder.encode('name,city\nAda,上海\n'), name: 'people.csv', mediaType: 'text/csv',
    })).resolves.toEqual({ text: 'name,city\nAda,上海\n', truncated: false, status: 'ready' })
    await expect(extractFileText({
      data: encoder.encode('plain UTF-8: café'), name: 'notes.txt', mediaType: 'text/plain',
    })).resolves.toEqual({ text: 'plain UTF-8: café', truncated: false, status: 'ready' })
  })

  it('extracts readable DOCX and XLSX XML content with a name or standard media type', async () => {
    const docx = zip({
      '[Content_Types].xml': DOCX_CONTENT_TYPES,
      '_rels/.rels': '<Relationships><Relationship Type="officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml': '<w:document><w:body><w:p><w:r><w:t>DOCX hello</w:t></w:r></w:p></w:body></w:document>',
    })
    const xlsx = zip({
      '[Content_Types].xml': XLSX_CONTENT_TYPES,
      '_rels/.rels': '<Relationships><Relationship Type="officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml': '<workbook/>',
      'xl/sharedStrings.xml': '<sst><si><t>XLSX shared text</t></si></sst>',
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c t="s"><v>0</v></c></row></sheetData></worksheet>',
    })

    const docxResult = await extractFileText({ data: docx, name: 'letter.docx' })
    const xlsxResult = await extractFileText({ data: xlsx, name: 'sheet.xlsx' })
    const unnamedDocxResult = await extractFileText({
      data: docx, mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const unnamedXlsxResult = await extractFileText({
      data: xlsx, mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    expect(docxResult).toMatchObject({ status: 'ready', truncated: false })
    expect(docxResult.text).toContain('DOCX hello')
    expect(xlsxResult).toMatchObject({ status: 'ready', truncated: false })
    expect(xlsxResult.text).toContain('XLSX shared text')
    expect(unnamedDocxResult.text).toContain('DOCX hello')
    expect(unnamedXlsxResult.text).toContain('XLSX shared text')
  })

  it('extracts readable text from a valid local PDF', async () => {
    const data = pdf('Local PDF text')

    await expect(extractFileText({ data, name: 'local.pdf', mediaType: 'application/pdf' }))
      .resolves.toEqual({ text: 'Local PDF text', truncated: false, status: 'ready' })
  })

  it('rejects PDFs with corrupt xref data or no visible text operator', async () => {
    await expect(extractFileText({ data: pdf('Broken xref', 1), name: 'broken-xref.pdf' }))
      .resolves.toEqual({ text: '', truncated: false, status: 'unavailable' })
    await expect(extractFileText({ data: pdf(undefined), name: 'blank.pdf' }))
      .resolves.toEqual({ text: '', truncated: false, status: 'unavailable' })
  })

  it('limits extracted text by Unicode code point and reports truncation', async () => {
    const data = encoder.encode(`${'🙂'.repeat(MAX_EXTRACTED_FILE_TEXT_CODE_POINTS)}!`)

    await expect(extractFileText({ data, name: 'long.txt' })).resolves.toEqual({
      text: '🙂'.repeat(MAX_EXTRACTED_FILE_TEXT_CODE_POINTS), truncated: true, status: 'ready',
    })
  })

  it('rejects Office entries whose compressed data expands beyond the local extraction budget', async () => {
    const docx = zip({
      '[Content_Types].xml': DOCX_CONTENT_TYPES,
      '_rels/.rels': '<Relationships><Relationship Type="officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml': `<w:document><w:body><w:t>${'a'.repeat(5 * 1024 * 1024)}</w:t></w:body></w:document>`,
    }, 'deflate')

    await expect(extractFileText({ data: docx, name: 'oversized.docx' }))
      .resolves.toEqual({ text: '', truncated: false, status: 'unavailable' })
  })

  it('rejects Office files that exceed one cumulative decompression budget or fail ZIP CRC validation', async () => {
    const xlsx = zip({
      '[Content_Types].xml': XLSX_CONTENT_TYPES,
      '_rels/.rels': '<Relationships><Relationship Type="officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml': '<workbook/>',
      'xl/sharedStrings.xml': `<sst><!-- ${'a'.repeat(3 * 1024 * 1024)} --></sst>`,
      'xl/worksheets/sheet1.xml': `<worksheet><!-- ${'b'.repeat(3 * 1024 * 1024)} --></worksheet>`,
    }, 'deflate')
    const docx = zip({
      '[Content_Types].xml': DOCX_CONTENT_TYPES,
      '_rels/.rels': '<Relationships><Relationship Type="officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml': '<w:document><w:body><w:t>CRC text</w:t></w:body></w:document>',
    })

    await expect(extractFileText({ data: xlsx, name: 'cumulative.xlsx' }))
      .resolves.toEqual({ text: '', truncated: false, status: 'unavailable' })
    await expect(extractFileText({ data: replaceFirst(docx, 'CRC text', 'BAD text'), name: 'corrupt.docx' }))
      .resolves.toEqual({ text: '', truncated: false, status: 'unavailable' })
  })

  it('rejects malformed OpenXML package structures', async () => {
    const docx = zip({ 'word/document.xml': '<w:document><w:body><w:t>orphan</w:t></w:body></w:document>' })

    await expect(extractFileText({ data: docx, name: 'orphan.docx' }))
      .resolves.toEqual({ text: '', truncated: false, status: 'unavailable' })
  })

  it.each([
    ['office', Uint8Array.of(0x50, 0x4b, 0x03, 0x04), 'broken.docx'],
    ['PDF', encoder.encode('%PDF-1.4\n1 0 obj\nthis is corrupt\nendobj\n%%EOF'), 'broken.pdf'],
  ])('reports unavailable for corrupt %s data', async (_kind, data, name) => {
    await expect(extractFileText({ data, name })).resolves.toEqual({ text: '', truncated: false, status: 'unavailable' })
  })
})
