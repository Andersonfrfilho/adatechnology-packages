/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Markdown → AST seguro. Blocos aceitos: título (`#`), parágrafo, lista (com aninhamento),
 * citação (`>`), código cercado (```), separador (`---`). Não existe HTML cru: uma linha
 * `<script>` é parágrafo de texto. Isomórfico — roda igual no servidor e no navegador.
 */

import type { MarkdownBlock, MarkdownDocument } from './markdown.types'
import { parseInline } from './parseInline'

const MAX_BLOCK_DEPTH = 6

const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)[^`]*$/
const HEADING_PATTERN = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const THEMATIC_BREAK_PATTERN = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const QUOTE_PATTERN = /^ {0,3}> ?(.*)$/
const LIST_ITEM_PATTERN = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/

type ListMarker = { readonly ordered: boolean; readonly delimiter: string; readonly start: number }

export function parseMarkdown(source: string): MarkdownDocument {
  const normalized = source
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex -- casar caractere de controle é o objetivo
    .replace(/\u0000/g, '\uFFFD')
    .replace(/\t/g, '    ')
  return { type: 'root', children: parseBlocks(normalized.split('\n'), 0) }
}

function parseBlocks(lines: readonly string[], depth: number): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] as string
    if (!line.trim()) {
      index += 1
      continue
    }
    const parsed = parseBlockAt(lines, index, depth)
    blocks.push(parsed.block)
    index = parsed.next
  }
  return blocks
}

type ParsedBlock = { readonly block: MarkdownBlock; readonly next: number }

function parseBlockAt(lines: readonly string[], index: number, depth: number): ParsedBlock {
  const line = lines[index] as string
  if (FENCE_PATTERN.test(line)) return parseFence(lines, index)

  const heading = HEADING_PATTERN.exec(line)
  if (heading) {
    const level = (heading[1] as string).length as 1 | 2 | 3 | 4 | 5 | 6
    return { block: { type: 'heading', level, children: parseInline(heading[2] ?? '') }, next: index + 1 }
  }
  if (THEMATIC_BREAK_PATTERN.test(line)) return { block: { type: 'thematicBreak' }, next: index + 1 }

  // Aninhamento além do teto vira parágrafo: limita a recursão de `> > > > …` digitado de propósito.
  if (depth < MAX_BLOCK_DEPTH && QUOTE_PATTERN.test(line)) return parseQuote(lines, index, depth)
  if (depth < MAX_BLOCK_DEPTH && LIST_ITEM_PATTERN.test(line)) return parseList(lines, index, depth)
  return parseParagraph(lines, index, depth)
}

function startsBlock(line: string, depth: number): boolean {
  return (
    FENCE_PATTERN.test(line) ||
    HEADING_PATTERN.test(line) ||
    THEMATIC_BREAK_PATTERN.test(line) ||
    (depth < MAX_BLOCK_DEPTH && (QUOTE_PATTERN.test(line) || LIST_ITEM_PATTERN.test(line)))
  )
}

function parseFence(lines: readonly string[], index: number): ParsedBlock {
  const opening = FENCE_PATTERN.exec(lines[index] as string) as RegExpExecArray
  const fence = opening[1] as string
  const language = (opening[2] ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9+#-]/g, '')
    .slice(0, 30)
  const content: string[] = []
  let cursor = index + 1
  while (cursor < lines.length) {
    const line = lines[cursor] as string
    const trimmed = line.trim()
    if (trimmed.startsWith(fence[0] as string) && trimmed.length >= fence.length && /^(`+|~+)$/.test(trimmed)) {
      cursor += 1
      break
    }
    content.push(line)
    cursor += 1
  }
  const block: MarkdownBlock = language
    ? { type: 'codeBlock', language, value: content.join('\n') }
    : { type: 'codeBlock', value: content.join('\n') }
  return { block, next: cursor }
}

function parseQuote(lines: readonly string[], index: number, depth: number): ParsedBlock {
  const inner: string[] = []
  let cursor = index
  while (cursor < lines.length) {
    const match = QUOTE_PATTERN.exec(lines[cursor] as string)
    if (!match) break
    inner.push(match[1] ?? '')
    cursor += 1
  }
  return { block: { type: 'blockquote', children: parseBlocks(inner, depth + 1) }, next: cursor }
}

function parseParagraph(lines: readonly string[], index: number, depth: number): ParsedBlock {
  const content: string[] = [(lines[index] as string).trimStart()]
  let cursor = index + 1
  while (cursor < lines.length) {
    const line = lines[cursor] as string
    if (!line.trim() || startsBlock(line, depth)) break
    content.push(line.trimStart())
    cursor += 1
  }
  return { block: { type: 'paragraph', children: parseInline(content.join('\n').trimEnd()) }, next: cursor }
}

function readMarker(
  line: string,
): (ListMarker & { readonly contentIndent: number; readonly text: string }) | undefined {
  const match = LIST_ITEM_PATTERN.exec(line)
  if (!match) return undefined
  const indent = (match[1] ?? '').length
  const marker = match[2] as string
  const spacing = (match[3] ?? '').length
  const ordered = /\d/.test(marker)
  // Espaço demais depois do marcador conta como 1: o resto é recuo do conteúdo do item.
  const contentIndent = indent + marker.length + (spacing === 0 || spacing > 4 ? 1 : spacing)
  return {
    ordered,
    delimiter: ordered ? marker.slice(-1) : marker,
    start: ordered ? Number.parseInt(marker, 10) : 1,
    contentIndent,
    text: match[4] ?? '',
  }
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length
}

function parseList(lines: readonly string[], index: number, depth: number): ParsedBlock {
  const first = readMarker(lines[index] as string) as NonNullable<ReturnType<typeof readMarker>>
  const items: MarkdownBlock[][] = []
  let tight = true
  let cursor = index

  while (cursor < lines.length) {
    const marker = readMarker(lines[cursor] as string)
    if (!marker || marker.ordered !== first.ordered || marker.delimiter !== first.delimiter) break

    const itemLines = [marker.text]
    cursor += 1
    let sawBlank = false
    while (cursor < lines.length) {
      const line = lines[cursor] as string
      if (!line.trim()) {
        sawBlank = true
        itemLines.push('')
        cursor += 1
        continue
      }
      if (indentOf(line) >= marker.contentIndent) {
        itemLines.push(line.slice(marker.contentIndent))
        cursor += 1
        continue
      }
      // Continuação preguiçosa: linha sem recuo logo abaixo do texto ainda é do mesmo parágrafo.
      if (!sawBlank && !startsBlock(line, depth)) {
        itemLines.push(line.trimStart())
        cursor += 1
        continue
      }
      break
    }

    while (itemLines.length > 0 && !(itemLines[itemLines.length - 1] as string).trim()) itemLines.pop()
    if (itemLines.some((line) => !line.trim())) tight = false
    items.push(parseBlocks(itemLines, depth + 1))

    // Linha em branco entre itens torna a lista "solta"; seguida de outra coisa, encerra a lista.
    const lookahead = lines[cursor]
    if (sawBlank && lookahead !== undefined && readMarker(lookahead)) tight = false
  }

  const block: MarkdownBlock = first.ordered
    ? { type: 'list', ordered: true, start: first.start, tight, items }
    : { type: 'list', ordered: false, tight, items }
  return { block, next: cursor }
}
