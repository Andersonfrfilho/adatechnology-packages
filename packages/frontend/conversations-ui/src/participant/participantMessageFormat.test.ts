import { describe, expect, it } from 'bun:test'

import { MAX_FORMATTED_LENGTH, parseParticipantMessage } from './participantMessageFormat'
import { show } from './participantMessageFormat.test-helper'
import type { FormatBlock } from './participantMessageFormat.types'

function showBlock(block: FormatBlock): string {
  if (block.kind === 'paragraph') return `P[${show(block.children)}]`
  if (block.kind === 'pre') return `PRE[${block.value}]`
  if (block.kind === 'quote') return `Q[${show(block.children)}]`
  const tag = block.ordered ? `OL${block.start}` : 'UL'
  return `${tag}[${block.items.map(show).join('|')}]`
}

function blocks(text: string | null | undefined): string {
  return parseParticipantMessage(text).map(showBlock).join(' ')
}

describe('parseParticipantMessage - input', () => {
  it('returns no blocks for empty, blank or missing input', () => {
    expect(blocks('')).toBe('')
    expect(blocks('   ')).toBe('')
    expect(blocks('\n \n')).toBe('')
    expect(blocks(null)).toBe('')
    expect(blocks(undefined)).toBe('')
  })

  it('keeps plain text as one paragraph with one text node', () => {
    expect(parseParticipantMessage('Olá, tudo bem?')).toEqual([
      { kind: 'paragraph', children: [{ kind: 'text', value: 'Olá, tudo bem?' }] },
    ])
  })

  it('preserves typed line breaks, including blank lines', () => {
    expect(blocks('a\nb')).toBe('P[a\nb]')
    expect(blocks('a\n\nb')).toBe('P[a\n\nb]')
    expect(blocks('a\r\nb')).toBe('P[a\nb]')
  })

  it('formats each line on its own: marks never cross a line break', () => {
    expect(blocks('*a\nb*')).toBe('P[*a\nb*]')
    expect(blocks('*a*\n_b_')).toBe('P[⟦s:a⟧\n⟦e:b⟧]')
  })
})

describe('parseParticipantMessage - size limit', () => {
  it('formats up to the limit', () => {
    const text = `*a*${' '.repeat(MAX_FORMATTED_LENGTH - 3)}`
    expect(text).toHaveLength(MAX_FORMATTED_LENGTH)
    expect(blocks(text).startsWith('P[⟦s:a⟧')).toBe(true)
  })

  it('treats anything above the limit as one plain text node', () => {
    const text = `*a* https://a.com\n> b\n${'x'.repeat(MAX_FORMATTED_LENGTH)}`
    expect(parseParticipantMessage(text)).toEqual([{ kind: 'paragraph', children: [{ kind: 'text', value: text }] }])
    const justOver = `*a*${' '.repeat(MAX_FORMATTED_LENGTH - 2)}`
    expect(justOver).toHaveLength(MAX_FORMATTED_LENGTH + 1)
    expect(parseParticipantMessage(justOver)).toHaveLength(1)
    expect(blocks(justOver)).not.toContain('⟦s:')
  })
})

describe('parseParticipantMessage - code blocks', () => {
  it('parses a multi-line block without a stray blank line', () => {
    expect(blocks('```\nconst a = 1\nconst b = 2\n```')).toBe('PRE[const a = 1\nconst b = 2]')
  })

  it('parses a single-line block and one that shares the fence lines', () => {
    expect(blocks('```x *y*```')).toBe('PRE[x *y*]')
    expect(blocks('```a\nb```')).toBe('PRE[a\nb]')
    expect(blocks('```js\nconst a = 1\n```')).toBe('PRE[const a = 1]')
    expect(blocks('```two words\nx\n```')).toBe('PRE[two words\nx]')
  })

  it('keeps inner blank lines and never formats inside', () => {
    expect(blocks('```\n*a*\n\n_b_ https://a.com 529.982.247-25\n```')).toBe(
      'PRE[*a*\n\n_b_ https://a.com 529.982.247-25]',
    )
  })

  it('keeps text around the block as paragraphs', () => {
    expect(blocks('antes\n```\nx\n```\ndepois')).toBe('P[antes] PRE[x] P[depois]')
  })

  it('treats an unclosed fence as plain text', () => {
    expect(blocks('```\nabc')).toBe('P[```\nabc]')
  })
})

describe('parseParticipantMessage - quotes', () => {
  it('turns consecutive quote lines into one block', () => {
    expect(blocks('> a\n> b')).toBe('Q[a\nb]')
    expect(blocks('> a\n> b\nc')).toBe('Q[a\nb] P[c]')
  })

  it('formats inline marks inside the quote', () => {
    expect(blocks('> *a* e _b_')).toBe('Q[⟦s:a⟧ e ⟦e:b⟧]')
  })

  it('needs the space after the marker and the marker at the start of the line', () => {
    expect(blocks('>a')).toBe('P[>a]')
    expect(blocks('a > b')).toBe('P[a > b]')
  })

  it('splits two quotes separated by a normal line', () => {
    expect(blocks('> a\nx\n> b')).toBe('Q[a] P[x] Q[b]')
  })
})

describe('parseParticipantMessage - lists', () => {
  it('parses bullet lists with the three markers', () => {
    expect(blocks('- a\n- b')).toBe('UL[a|b]')
    expect(blocks('* a\n* b')).toBe('UL[a|b]')
    expect(blocks('• a\n• b')).toBe('UL[a|b]')
  })

  it('requires the space after the marker', () => {
    expect(blocks('-a')).toBe('P[-a]')
    expect(blocks('*a*')).toBe('P[⟦s:a⟧]')
    expect(blocks('•a')).toBe('P[•a]')
    expect(blocks('- ')).toBe('P[- ]')
  })

  it('parses numbered lists with dot or parenthesis and keeps the first number', () => {
    expect(blocks('1. a\n2. b')).toBe('OL1[a|b]')
    expect(blocks('1) a\n2) b')).toBe('OL1[a|b]')
    expect(blocks('3. a\n4. b')).toBe('OL3[a|b]')
    expect(blocks('1.a')).toBe('P[1.a]')
  })

  it('formats inline marks inside items', () => {
    expect(blocks('- *a*\n- _b_ https://a.com')).toBe('UL[⟦s:a⟧|⟦e:b⟧ ⟦l:https://a.com→https://a.com⟧]')
  })

  it('splits different list kinds and keeps surrounding text', () => {
    expect(blocks('- a\n1. b')).toBe('UL[a] OL1[b]')
    expect(blocks('título\n- a\n- b\nfim')).toBe('P[título] UL[a|b] P[fim]')
  })

  it('does not take a sentence with a number as a list', () => {
    expect(blocks('2 * 3 * 4')).toBe('P[2 * 3 * 4]')
    expect(blocks('2026. foi bom')).toBe('P[2026. foi bom]')
  })
})

describe('parseParticipantMessage - emoji', () => {
  it('does not touch ZWJ sequences, flags, skin tones or variation selectors', () => {
    const text = '👨‍👩‍👧 🇧🇷 👍🏽 ‼️'
    expect(parseParticipantMessage(text)).toEqual([{ kind: 'paragraph', children: [{ kind: 'text', value: text }] }])
    expect(blocks('- 👨‍👩‍👧\n- 🇧🇷')).toBe('UL[👨‍👩‍👧|🇧🇷]')
  })
})

describe('parseParticipantMessage - pathological input', () => {
  const CASES: readonly (readonly [string, string])[] = [
    ['alternating marks', '*_'.repeat(4000)],
    ['open brackets', '['.repeat(8000)],
    ['unmatched openers', '*a '.repeat(2666)],
    ['backticks', '`'.repeat(8000)],
    ['mixed marks', '~_*'.repeat(2666)],
    ['at signs', 'a@'.repeat(4000)],
    ['schemes', 'http://'.repeat(1100)],
    ['digits', '1'.repeat(8000)],
    ['many lines', '> *a\n- _b\n'.repeat(800)],
    ['fences', '```\n'.repeat(1600)],
  ]

  it('parses the worst cases under 50ms each', () => {
    for (const [name, input] of CASES) {
      parseParticipantMessage(input.slice(0, 200))
      const startedAt = performance.now()
      parseParticipantMessage(input.slice(0, 8000))
      const elapsed = performance.now() - startedAt
      expect({ name, fast: elapsed < 50 }).toEqual({ name, fast: true })
    }
  })
})
