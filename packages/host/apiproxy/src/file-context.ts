/** Complete-value budgeting for model-visible local file extraction context. */

const TRUNCATED_NOTICE = '[Local text extraction truncated.]'
const UNAVAILABLE_NOTICE = '[Local text extraction unavailable; file contents were not read.]'

/** Extraction result needed by the message-context serializer. */
export type FileContextExtraction =
  | { readonly status: 'ready'; readonly text: string; readonly truncated: boolean }
  | { readonly status: 'unavailable' }

/** One durable filename paired with its local extraction result. */
export interface ExtractedFileContextInput {
  readonly name: string
  readonly extracted: FileContextExtraction
}

function codePointCount(value: string): number {
  return Array.from(value).length
}

/** Return at most `limit` Unicode code points without splitting a surrogate pair. */
function takeCodePoints(value: string, limit: number): string {
  let count = 0
  let end = 0
  for (const point of value) {
    if (count === limit) break
    count += 1
    end += point.length
  }
  return value.slice(0, end)
}

function header(name: string): string {
  return `[File: ${name}]\n`
}

function fullContext(input: ExtractedFileContextInput): string {
  const prefix = header(input.name)
  if (input.extracted.status === 'unavailable') return `${prefix}${UNAVAILABLE_NOTICE}`
  const { text, truncated } = input.extracted
  return `${prefix}${text}${truncated ? `${text.length === 0 ? '' : '\n'}${TRUNCATED_NOTICE}` : ''}`
}

function truncatedContext(input: ExtractedFileContextInput): string {
  return `${header(input.name)}${TRUNCATED_NOTICE}`
}

function minimumContext(input: ExtractedFileContextInput): string {
  const full = fullContext(input)
  if (input.extracted.status === 'unavailable') return full
  const truncated = truncatedContext(input)
  return codePointCount(full) <= codePointCount(truncated) ? full : truncated
}

/**
 * Serialize extracted file text under one aggregate complete-value cap.
 * Headers and notices are reserved for every file before any earlier file may
 * consume text budget, so the returned strings together never exceed `limit`.
 * @param inputs - durable display names paired with local extraction results.
 * @param limit - maximum Unicode code points across every returned string.
 * @returns one model-visible context string per input in the same order.
 */
export function extractedFileContexts(
  inputs: readonly ExtractedFileContextInput[],
  limit: number,
): readonly string[] {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('File context limit must be a non-negative integer.')

  const minimums = inputs.map(minimumContext)
  const minimumCounts = minimums.map(codePointCount)
  const minimumTotal = minimumCounts.reduce((total, count) => total + count, 0)
  if (minimumTotal > limit) throw new RangeError('File context limit cannot contain the required filename headers and notices.')

  const result: string[] = []
  let remaining = limit
  let futureMinimum = minimumTotal
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index] as ExtractedFileContextInput
    const minimumCount = minimumCounts[index] as number
    futureMinimum -= minimumCount
    const available = remaining - futureMinimum
    const full = fullContext(input)
    if (codePointCount(full) <= available) {
      result.push(full)
      remaining -= codePointCount(full)
      continue
    }

    // An unavailable value is already its minimum and therefore reached the
    // full branch above. Ready values spend every usable point on content,
    // retaining one separator before the truthful truncation notice.
    if (input.extracted.status === 'unavailable') throw new Error('Unavailable file context exceeded its reserved budget.')
    const prefix = header(input.name)
    const fixedCount = codePointCount(prefix) + codePointCount(TRUNCATED_NOTICE)
    const textAndSeparatorBudget = available - fixedCount
    const text = textAndSeparatorBudget >= 2
      ? takeCodePoints(input.extracted.text, textAndSeparatorBudget - 1)
      : ''
    const value = `${prefix}${text}${text.length === 0 ? '' : '\n'}${TRUNCATED_NOTICE}`
    result.push(value)
    remaining -= codePointCount(value)
  }
  return result
}
