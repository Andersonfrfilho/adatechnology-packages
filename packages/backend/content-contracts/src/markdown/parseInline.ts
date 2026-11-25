/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Parser de trechos em linha: ênfase, negrito, tachado, código, link, imagem e quebra de linha.
 * Subconjunto do CommonMark escolhido para texto de blog — não há HTML em linha nem referência de
 * link. Todo texto sai como nó `text`, e quem renderiza escapa.
 *
 * Custo linear na prática: cada busca de fechamento que falha fica memorizada, então um parágrafo
 * com mil `*` soltos não vira mil varreduras até o fim do texto.
 */

import type { MarkdownInline } from './markdown.types'
import { sanitizeImageUrl, sanitizeLinkUrl } from './sanitizeUrl'

const MAX_NESTING = 8
// Link com texto ou destino maior que isto vira texto: limita a varredura de `[` sem par.
const MAX_BRACKET_SCAN = 2000
const ESCAPABLE = new Set('\\`*_{}[]()#+-.!|~<>"\'')

type DelimiterRule = { readonly marker: string; readonly type: 'strong' | 'emphasis' | 'strikethrough' }

const DELIMITERS: readonly DelimiterRule[] = [
  { marker: '**', type: 'strong' },
  { marker: '__', type: 'strong' },
  { marker: '~~', type: 'strikethrough' },
  { marker: '*', type: 'emphasis' },
  { marker: '_', type: 'emphasis' },
]

type InlineState = {
  readonly text: string
  readonly depth: number
  /** marcador → posição a partir da qual já se sabe que não há fechamento válido. */
  readonly noCloserFrom: Map<string, number>
}

export function parseInline(text: string, depth = 0): MarkdownInline[] {
  return new InlineParser({ text, depth, noCloserFrom: new Map() }).parse()
}

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}]/u.test(character)
}

function isWhitespace(character: string | undefined): boolean {
  return character === undefined || /\s/.test(character)
}

class InlineParser {
  private readonly nodes: MarkdownInline[] = []
  private buffer = ''
  private position = 0

  constructor(private readonly state: InlineState) {}

  parse(): MarkdownInline[] {
    const { text } = this.state
    while (this.position < text.length) {
      if (!this.tryToken()) {
        this.buffer += text[this.position]
        this.position += 1
      }
    }
    this.flush()
    return this.nodes
  }

  private tryToken(): boolean {
    const character = this.state.text[this.position]
    if (character === '\\') return this.tryEscape()
    if (character === '\n') return this.tryLineBreak()
    if (character === '`') return this.tryCodeSpan()
    if (character === '!' && this.state.text[this.position + 1] === '[') return this.tryLinkOrImage(true)
    if (character === '[') return this.tryLinkOrImage(false)
    if (character === '<') return this.tryAutolink()
    if (character === '*' || character === '_' || character === '~') return this.tryDelimited()
    return false
  }

  private push(node: MarkdownInline): void {
    this.flush()
    this.nodes.push(node)
  }

  private flush(): void {
    if (!this.buffer) return
    this.nodes.push({ type: 'text', value: this.buffer })
    this.buffer = ''
  }

  private tryEscape(): boolean {
    const next = this.state.text[this.position + 1]
    if (next === '\n') {
      this.push({ type: 'break' })
      this.position += 2
      return true
    }
    if (next === undefined || !ESCAPABLE.has(next)) return false
    this.buffer += next
    this.position += 2
    return true
  }

  /** Dois espaços antes da quebra = `<br>`; quebra simples vira espaço, como no CommonMark. */
  private tryLineBreak(): boolean {
    if (this.buffer.endsWith('  ')) {
      this.buffer = this.buffer.replace(/ +$/, '')
      this.push({ type: 'break' })
    } else {
      this.buffer = `${this.buffer.replace(/ +$/, '')} `
    }
    this.position += 1
    return true
  }

  private tryCodeSpan(): boolean {
    const { text } = this.state
    let runEnd = this.position
    while (text[runEnd] === '`') runEnd += 1
    const run = text.slice(this.position, runEnd)
    const memoKey = `code:${run.length}`
    if ((this.state.noCloserFrom.get(memoKey) ?? Infinity) <= runEnd) return this.literal(run)

    let search = runEnd
    while (true) {
      const found = text.indexOf(run, search)
      if (found === -1) {
        this.state.noCloserFrom.set(memoKey, runEnd)
        return this.literal(run)
      }
      const closerEnd = found + run.length
      // O fechamento tem de ser uma sequência do MESMO tamanho, não um pedaço de uma maior.
      if (text[closerEnd] === '`' || text[found - 1] === '`') {
        search = closerEnd
        while (text[search] === '`') search += 1
        continue
      }
      let value = text.slice(runEnd, found).replace(/\n/g, ' ')
      if (value.length > 2 && value.startsWith(' ') && value.endsWith(' ') && value.trim()) value = value.slice(1, -1)
      this.push({ type: 'inlineCode', value })
      this.position = closerEnd
      return true
    }
  }

  private literal(value: string): boolean {
    this.buffer += value
    this.position += value.length
    return true
  }

  private tryLinkOrImage(isImage: boolean): boolean {
    const { text } = this.state
    const open = this.position + (isImage ? 1 : 0)
    const close = findClosingBracket(text, open)
    if (close === undefined || text[close + 1] !== '(') return false
    const destination = parseDestination(text, close + 2)
    if (!destination) return false

    const label = text.slice(open + 1, close)
    this.position = destination.end
    if (isImage) {
      this.pushImage(label, destination)
      return true
    }
    const children = this.parseNested(label)
    const href = sanitizeLinkUrl(destination.url)
    if (!href) {
      // Destino inseguro: fica o texto, sem âncora — o leitor ainda lê o que o autor escreveu.
      this.flush()
      this.nodes.push(...children)
      return true
    }
    this.push({ type: 'link', href, ...(destination.title ? { title: destination.title } : {}), children })
    return true
  }

  private pushImage(alt: string, destination: Destination): void {
    const plainAlt = alt.replace(/[\\*_`~[\]]/g, '')
    const src = sanitizeImageUrl(destination.url)
    if (!src) {
      this.buffer += plainAlt
      return
    }
    this.push({ type: 'image', src, alt: plainAlt, ...(destination.title ? { title: destination.title } : {}) })
  }

  private tryAutolink(): boolean {
    const { text } = this.state
    const close = text.indexOf('>', this.position)
    if (close === -1 || close - this.position > MAX_BRACKET_SCAN) return false
    const candidate = text.slice(this.position + 1, close)
    if (!/^(https?:\/\/|mailto:)[^\s<>]+$/i.test(candidate)) return false
    const href = sanitizeLinkUrl(candidate)
    if (!href) return false
    this.push({ type: 'link', href, children: [{ type: 'text', value: candidate }] })
    this.position = close + 1
    return true
  }

  private tryDelimited(): boolean {
    const { text } = this.state
    const rule = DELIMITERS.find((candidate) => text.startsWith(candidate.marker, this.position))
    if (!rule || this.state.depth >= MAX_NESTING) return false

    const contentStart = this.position + rule.marker.length
    // Abertura não pode vir seguida de espaço, e `_` no meio de palavra (snake_case) é texto.
    if (isWhitespace(text[contentStart])) return false
    if (rule.marker.startsWith('_') && isWordCharacter(text[this.position - 1])) return false

    const closer = this.findCloser(rule, contentStart)
    if (closer === undefined) return false

    this.push({ type: rule.type, children: this.parseNested(text.slice(contentStart, closer)) })
    this.position = closer + rule.marker.length
    return true
  }

  private findCloser(rule: DelimiterRule, contentStart: number): number | undefined {
    const { text, noCloserFrom } = this.state
    if ((noCloserFrom.get(rule.marker) ?? Infinity) <= contentStart) return undefined

    let search = contentStart + 1
    while (true) {
      const found = text.indexOf(rule.marker, search)
      if (found === -1) {
        noCloserFrom.set(rule.marker, contentStart)
        return undefined
      }
      const after = text[found + rule.marker.length]
      const valid =
        !isWhitespace(text[found - 1]) &&
        // `*` simples não fecha no primeiro `*` de um `**`: aquele par é de negrito.
        !(rule.marker.length === 1 && (after === rule.marker || text[found - 1] === rule.marker)) &&
        !(rule.marker.startsWith('_') && isWordCharacter(after))
      if (valid) return found
      search = found + 1
    }
  }

  private parseNested(text: string): MarkdownInline[] {
    return new InlineParser({ text, depth: this.state.depth + 1, noCloserFrom: new Map() }).parse()
  }
}

type Destination = { readonly url: string; readonly title?: string; readonly end: number }

function findClosingBracket(text: string, open: number): number | undefined {
  let depth = 0
  const limit = Math.min(text.length, open + MAX_BRACKET_SCAN)
  for (let index = open; index < limit; index += 1) {
    const character = text[index]
    if (character === '\\') {
      index += 1
    } else if (character === '[') {
      depth += 1
    } else if (character === ']') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return undefined
}

/** `(url)`, `(url "título")` ou `(<url com espaço>)`. Parênteses equilibrados dentro da URL. */
function parseDestination(text: string, start: number): Destination | undefined {
  const limit = Math.min(text.length, start + MAX_BRACKET_SCAN)
  let index = start
  while (index < limit && text[index] === ' ') index += 1

  let url = ''
  if (text[index] === '<') {
    const close = text.indexOf('>', index)
    if (close === -1 || close >= limit) return undefined
    url = text.slice(index + 1, close)
    index = close + 1
  } else {
    let depth = 0
    while (index < limit) {
      const character = text[index] as string
      if (/\s/.test(character)) break
      if (character === '(') depth += 1
      if (character === ')') {
        if (depth === 0) break
        depth -= 1
      }
      url += character
      index += 1
    }
  }

  while (index < limit && text[index] === ' ') index += 1
  let title: string | undefined
  const quote = text[index]
  if (quote === '"' || quote === "'") {
    const close = text.indexOf(quote, index + 1)
    if (close === -1 || close >= limit) return undefined
    title = text.slice(index + 1, close)
    index = close + 1
    while (index < limit && text[index] === ' ') index += 1
  }
  if (text[index] !== ')') return undefined
  return { url, ...(title ? { title } : {}), end: index + 1 }
}
