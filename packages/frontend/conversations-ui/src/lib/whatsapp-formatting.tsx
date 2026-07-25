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

export function waToHTML(text: string): string {
  return text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~([^~]+)~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

export function htmlToWA(html: string): string {
  return html
    .replace(/<strong>(.*?)<\/strong>/g, '*$1*')
    .replace(/<b>(.*?)<\/b>/g, '*$1*')
    .replace(/<em>(.*?)<\/em>/g, '_$1_')
    .replace(/<i>(.*?)<\/i>/g, '_$1_')
    .replace(/<del>(.*?)<\/del>/g, '~$1~')
    .replace(/<s>(.*?)<\/s>/g, '~$1~')
    .replace(/<strike>(.*?)<\/strike>/g, '~$1~')
    .replace(/<code>(.*?)<\/code>/g, '`$1`')
    .replace(/<pre><code>(.*?)<\/code><\/pre>/g, '```$1```')
}
