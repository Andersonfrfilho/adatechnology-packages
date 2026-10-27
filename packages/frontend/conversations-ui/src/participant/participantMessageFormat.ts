import type { FormatBlock, InlineNode } from './participantMessageFormat.types'
import { parseInline } from './participantMessageInline'

/** Above this size the text is shown as typed: formatting is a courtesy, not a cost. */
export const MAX_FORMATTED_LENGTH = 8000

const FENCE = '```'
const LANGUAGE_LABEL = /^[a-z][a-z0-9+#.-]{0,19}$/i
const QUOTE_PREFIX = /^> /
const BULLET_PREFIX = /^[-*•] +(?=\S)/
const ORDERED_PREFIX = /^(\d{1,3})[.)] +(?=\S)/

type ListBlock = Extract<FormatBlock, { kind: 'list' }>

function joinLines(lines: readonly string[]): InlineNode[] {
  const nodes: InlineNode[] = []
  lines.forEach((line, index) => {
    if (index > 0) nodes.push({ kind: 'text', value: '\n' })
    nodes.push(...parseInline(line))
  })
  return mergeText(nodes)
}

function mergeText(nodes: readonly InlineNode[]): InlineNode[] {
  const merged: InlineNode[] = []
  for (const node of nodes) {
    const previous = merged[merged.length - 1]
    if (node.kind === 'text' && previous?.kind === 'text') {
      merged[merged.length - 1] = { kind: 'text', value: previous.value + node.value }
    } else {
      merged.push(node)
    }
  }
  return merged
}

function plainParagraph(text: string): FormatBlock[] {
  return [{ kind: 'paragraph', children: [{ kind: 'text', value: text }] }]
}

type Fence = { readonly value: string; readonly nextIndex: number }

function readFence(lines: readonly string[], index: number): Fence | undefined {
  const first = (lines[index] ?? '').trimStart()
  if (!first.startsWith(FENCE)) return undefined
  const inner = first.slice(FENCE.length)
  if (inner.trimEnd().endsWith(FENCE) && inner.trim() !== FENCE) {
    return { value: inner.trimEnd().slice(0, -FENCE.length), nextIndex: index + 1 }
  }
  const hasLabel = LANGUAGE_LABEL.test(inner.trim())
  const body: string[] = inner === '' || hasLabel ? [] : [inner]
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = (lines[cursor] ?? '').trimEnd()
    if (!line.endsWith(FENCE)) {
      body.push(line)
      continue
    }
    const last = line.slice(0, -FENCE.length)
    if (last !== '') body.push(last)
    if (last !== '' && hasLabel && body.length === 1) body.unshift(inner)
    return { value: body.join('\n'), nextIndex: cursor + 1 }
  }
  return undefined
}

function startsSpecialBlock(line: string): boolean {
  const trimmed = line.trimStart()
  return trimmed.startsWith(FENCE) || QUOTE_PREFIX.test(line) || BULLET_PREFIX.test(line) || ORDERED_PREFIX.test(line)
}

function readQuote(lines: readonly string[], index: number): { block: FormatBlock; nextIndex: number } {
  const quoted: string[] = []
  let cursor = index
  while (cursor < lines.length && QUOTE_PREFIX.test(lines[cursor] ?? '')) {
    quoted.push((lines[cursor] ?? '').slice(2))
    cursor += 1
  }
  return { block: { kind: 'quote', children: joinLines(quoted) }, nextIndex: cursor }
}

function readList(lines: readonly string[], index: number): { block: ListBlock; nextIndex: number } {
  const ordered = ORDERED_PREFIX.test(lines[index] ?? '')
  const prefix = ordered ? ORDERED_PREFIX : BULLET_PREFIX
  const start = ordered ? Number(ORDERED_PREFIX.exec(lines[index] ?? '')?.[1] ?? 1) : 1
  const items: InlineNode[][] = []
  let cursor = index
  while (cursor < lines.length && prefix.test(lines[cursor] ?? '')) {
    items.push(parseInline((lines[cursor] ?? '').replace(prefix, '')))
    cursor += 1
  }
  return { block: { kind: 'list', ordered, start, items }, nextIndex: cursor }
}

function readParagraph(lines: readonly string[], index: number): { block: FormatBlock; nextIndex: number } {
  const collected: string[] = [lines[index] ?? '']
  let cursor = index + 1
  while (cursor < lines.length && !startsSpecialBlock(lines[cursor] ?? '')) {
    collected.push(lines[cursor] ?? '')
    cursor += 1
  }
  return { block: { kind: 'paragraph', children: joinLines(collected) }, nextIndex: cursor }
}

function readBlock(
  lines: readonly string[],
  index: number,
  canFence: boolean,
): { block: FormatBlock; nextIndex: number } {
  const line = lines[index] ?? ''
  const fence = canFence ? readFence(lines, index) : undefined
  if (fence) return { block: { kind: 'pre', value: fence.value }, nextIndex: fence.nextIndex }
  if (QUOTE_PREFIX.test(line)) return readQuote(lines, index)
  if (BULLET_PREFIX.test(line) || ORDERED_PREFIX.test(line)) return readList(lines, index)
  return readParagraph(lines, index)
}

export function parseParticipantMessage(text: string | null | undefined): readonly FormatBlock[] {
  if (typeof text !== 'string' || text.trim() === '') return []
  if (text.length > MAX_FORMATTED_LENGTH) return plainParagraph(text)
  const lines = text.split(/\r\n?|\n/)
  const blocks: FormatBlock[] = []
  let canFence = true
  let index = 0
  while (index < lines.length) {
    const { block, nextIndex } = readBlock(lines, index, canFence)
    if (block.kind === 'paragraph' && startsFenceLine(lines[index])) canFence = false
    blocks.push(block)
    index = nextIndex
  }
  return blocks
}

function startsFenceLine(line: string | undefined): boolean {
  return (line ?? '').trimStart().startsWith(FENCE)
}
