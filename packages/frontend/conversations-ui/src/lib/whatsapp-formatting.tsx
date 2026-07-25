import type { ReactNode } from 'react'

interface FormatToken {
  type: 'text' | 'bold' | 'italic' | 'strikethrough' | 'monospace' | 'codeblock'
  content: string
}

const MONOSPACE_REGEX = /```([\s\S]*?)```/g
const BOLD_REGEX = /\*([^*]+)\*/g
const ITALIC_REGEX = /_([^_]+)_/g
const STRIKETHROUGH_REGEX = /~([^~]+)~/g
const INLINE_CODE_REGEX = /`([^`]+)`/g

function tokenize(text: string): FormatToken[] {
  const tokens: FormatToken[] = []

  let remaining = text

  const codeBlocks: { index: number; content: string }[] = []
  remaining = remaining.replace(MONOSPACE_REGEX, (_match, content, offset) => {
    codeBlocks.push({ index: offset, content })
    return '\u0000'.repeat(_match.length)
  })

  let codeBlockIndex = 0
  let i = 0
  let buffer = ''

  while (i < remaining.length) {
    if (remaining[i] === '\u0000') {
      if (buffer) {
        tokens.push(...parseInlineTokens(buffer))
        buffer = ''
      }
      const cb = codeBlocks[codeBlockIndex++]
      tokens.push({ type: 'codeblock', content: cb.content })
      const skip = '```' + cb.content + '```'
      i += skip.length
      continue
    }
    // Check for inline code
    const inlineMatch = remaining.slice(i).match(/^`([^`]+)`/)
    if (inlineMatch && inlineMatch.index === 0) {
      if (buffer) {
        tokens.push(...parseInlineTokens(buffer))
        buffer = ''
      }
      tokens.push({ type: 'monospace', content: inlineMatch[1] })
      i += inlineMatch[0].length
      continue
    }

    buffer += remaining[i]
    i++
  }

  if (buffer) {
    tokens.push(...parseInlineTokens(buffer))
  }

  return tokens
}

function parseInlineTokens(text: string): FormatToken[] {
  const result: FormatToken[] = []
  let remaining = text

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^\*([^*]+)\*/)
    if (boldMatch) {
      result.push({ type: 'bold', content: boldMatch[1] })
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }
    const italicMatch = remaining.match(/^_([^_]+)_/)
    if (italicMatch) {
      result.push({ type: 'italic', content: italicMatch[1] })
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }
    const strikeMatch = remaining.match(/^~([^~]+)~/)
    if (strikeMatch) {
      result.push({ type: 'strikethrough', content: strikeMatch[1] })
      remaining = remaining.slice(strikeMatch[0].length)
      continue
    }

    const nextSpecial = remaining.search(/[*_~`]/)
    if (nextSpecial === -1) {
      if (remaining) result.push({ type: 'text', content: remaining })
      break
    }
    if (nextSpecial > 0) {
      result.push({ type: 'text', content: remaining.slice(0, nextSpecial) })
    }
    remaining = remaining.slice(nextSpecial)
  }

  return result
}

export function parseWhatsAppFormatting(text: string): ReactNode[] {
  const tokens = tokenize(text)

  return tokens.map((token, index) => {
    switch (token.type) {
      case 'bold':
        return <strong key={index}>{token.content}</strong>
      case 'italic':
        return <em key={index}>{token.content}</em>
      case 'strikethrough':
        return <del key={index}>{token.content}</del>
      case 'monospace':
        return <code key={index} className="bg-gray-100 px-1 py-0.5 rounded text-sm">{token.content}</code>
      case 'codeblock':
        return (
          <pre key={index} className="bg-gray-100 p-2 rounded text-sm overflow-x-auto my-1">
            <code>{token.content}</code>
          </pre>
        )
      default:
        return <span key={index}>{token.content}</span>
    }
  })
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function unescapeHtml(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
}

// Marcador da Private Use Area do Unicode — praticamente impossível de colidir com
// texto real de mensagem, ao contrário de um sentinela em ASCII (ex: dígitos soltos).
const CODE_TOKEN_MARK = String.fromCharCode(0xe000)
const CODE_TOKEN_REGEX = new RegExp(`${CODE_TOKEN_MARK}(\\d+)${CODE_TOKEN_MARK}`, 'g')

// waToHTML/htmlToWA formam um par round-trip: todo texto que sai de waToHTML deve
// reconstruir exatamente o original ao passar por htmlToWA (inclusive blocos de
// código multi-linha, que exigem distinguir ``` de ` via atributo data-wa).
export function waToHTML(text: string): string {
  if (!text) return ''

  const codeTokens: { type: 'block' | 'inline'; content: string }[] = []
  let working = text.replace(/```([\s\S]*?)```/g, (_match, content: string) => {
    codeTokens.push({ type: 'block', content })
    return `${CODE_TOKEN_MARK}${codeTokens.length - 1}${CODE_TOKEN_MARK}`
  })
  working = working.replace(/`([^`\n]+)`/g, (_match, content: string) => {
    codeTokens.push({ type: 'inline', content })
    return `${CODE_TOKEN_MARK}${codeTokens.length - 1}${CODE_TOKEN_MARK}`
  })

  let html = escapeHtml(working)
  html = html.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>')
  html = html.replace(/~([^~\n]+)~/g, '<del>$1</del>')
  html = html.replace(/\n/g, '<br>')

  html = html.replace(CODE_TOKEN_REGEX, (_match, indexStr: string) => {
    const token = codeTokens[Number(indexStr)]
    const escaped = escapeHtml(token.content)
    if (token.type === 'block') {
      return `<code data-wa="block" class="block bg-black/5 dark:bg-white/10 rounded px-1.5 py-0.5 font-mono text-sm whitespace-pre-wrap">${escaped.replace(/\n/g, '<br>')}</code>`
    }
    return `<code data-wa="inline" class="bg-black/5 dark:bg-white/10 rounded px-0.5 font-mono text-sm">${escaped}</code>`
  })

  return html
}

export function htmlToWA(html: string): string {
  if (!html) return ''

  let text = html
  text = text.replace(/<code data-wa="block"[^>]*>([\s\S]*?)<\/code>/gi, (_match, inner: string) => (
    `\`\`\`${unescapeHtml(inner.replace(/<br\s*\/?>/gi, '\n'))}\`\`\``
  ))
  text = text.replace(/<code data-wa="inline"[^>]*>([\s\S]*?)<\/code>/gi, (_match, inner: string) => (
    `\`${unescapeHtml(inner)}\``
  ))

  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')

  text = text.replace(/<strong>(.*?)<\/strong>/gi, '*$1*')
  text = text.replace(/<b>(.*?)<\/b>/gi, '*$1*')
  text = text.replace(/<em>(.*?)<\/em>/gi, '_$1_')
  text = text.replace(/<i>(.*?)<\/i>/gi, '_$1_')
  text = text.replace(/<del>(.*?)<\/del>/gi, '~$1~')
  text = text.replace(/<s>(.*?)<\/s>/gi, '~$1~')
  // Compat: HTML sem os marcadores data-wa (ex: vindo de outro editor) ainda vira código inline.
  text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')

  text = text.replace(/<[^>]+>/g, '')
  text = unescapeHtml(text)
  return text.trim()
}

// Variante inline para contextos de preview (ex: última mensagem numa lista) — sem
// suporte a bloco de código nem quebras de linha, propositalmente mais simples.
export function waToHTMLInline(text: string): string {
  if (!text) return ''
  return escapeHtml(text)
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<del>$1</del>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
}
