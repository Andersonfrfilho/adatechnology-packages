import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

import { splitBlocks } from '../cssBlocks.test-helper'
import { PARTICIPANT_CSS, declarationsIn } from './participantCss.test-helper'

const TEXT_SELECTOR = /\.cv-p-(text|copyable)/

function collectBlocks(css: string): string[] {
  return splitBlocks(css).flatMap(({ prelude, body }) => {
    if (body === undefined) return []
    if (prelude.startsWith('@media')) return collectBlocks(body)
    return TEXT_SELECTOR.test(prelude) ? [`${prelude} {${body}}`] : []
  })
}

function forcedColorsBody(): string {
  return splitBlocks(PARTICIPANT_CSS)
    .filter(({ prelude }) => prelude === '@media (forced-colors: active)')
    .map(({ body }) => body ?? '')
    .join('\n')
}

const TEXT_CSS = collectBlocks(PARTICIPANT_CSS).join('\n')

describe('participant message text - stylesheet', () => {
  it('has rules for the text, the code, the block, the quote and the tokens', () => {
    expect(collectBlocks(PARTICIPANT_CSS).length).toBeGreaterThan(12)
  })

  it('uses no fixed colour and no url()', () => {
    expect(TEXT_CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(TEXT_CSS).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/i)
    expect(TEXT_CSS).not.toContain('url(')
  })

  it('keeps the text selectable and the typography of the old text', () => {
    const text = declarationsIn('.cv-p-text')
    expect(text.get('user-select')).toBe('text')
    expect(text.get('white-space')).toBe('pre-wrap')
    expect(text.get('font-size')).toBe('14.2px')
    expect(text.get('line-height')).toBe('19px')
  })

  it('styles inline code and the block from the tokens', () => {
    expect(declarationsIn('.cv-p-text__code').get('background')).toBe(
      declarationsIn('.cv-p-text__pre').get('background'),
    )
    expect(declarationsIn('.cv-p-text__code').get('background')).toContain('color-mix(in srgb, var(--cv-p-i-border)')
    expect(declarationsIn('.cv-p-text__code').get('border-radius')).toBe('var(--cv-p-i-radius)')
    const pre = declarationsIn('.cv-p-text__pre')
    expect(pre.get('overflow-x')).toBe('auto')
    expect(pre.get('white-space')).toBe('pre')
    expect(pre.get('border-inline-start')).toBe('2px solid var(--cv-p-i-accent)')
    expect(pre.get('scrollbar-color')).toBe('var(--cv-p-i-scrollbar-thumb) transparent')
  })

  it('styles the quote, the lists and the links from the tokens', () => {
    const quote = declarationsIn('.cv-p-text__quote')
    expect(quote.get('border-inline-start')).toBe('3px solid var(--cv-p-i-border)')
    expect(quote.get('color')).toBe('var(--cv-p-i-text-muted)')
    expect(declarationsIn('.cv-p-text__list').get('padding-inline-start')).toBe('1.25rem')
    const link = declarationsIn('.cv-p-text__link')
    expect(link.get('color')).toBe('var(--cv-p-i-accent)')
    expect(link.get('text-decoration')).toBe('underline')
    expect(link.get('overflow-wrap')).toBe('anywhere')
    expect(declarationsIn('.cv-p-text__link:focus-visible').get('outline')).toBe('2px solid var(--cv-p-i-accent)')
  })

  it('highlights tokens discreetly with the accent', () => {
    const token = declarationsIn('.cv-p-copyable')
    expect(token.get('background')).toBe('color-mix(in srgb, var(--cv-p-i-accent) 14%, transparent)')
    expect(token.get('border-bottom')).toBe('1px dotted var(--cv-p-i-accent)')
    expect(token.get('font-family')).toContain('monospace')
    expect(token.get('border-radius')).toBe('var(--cv-p-i-radius)')
    expect(token.get('user-select')).toBe('text')
  })

  it('gives tokens and the copy icon a touch target of at least 2.75rem without inflating the line', () => {
    expect(declarationsIn('.cv-p-').size).toBe(0)
    expect(declarationsIn('.cv-p').get('--cv-p-i-touch')).toBe('2.75rem')
    for (const selector of ['.cv-p-copyable::after', '.cv-p-text__link-copy::after']) {
      expect(declarationsIn(selector).get('min-height')).toBe('var(--cv-p-i-touch)')
    }
    expect(declarationsIn('.cv-p-copyable').get('display')).toBe('inline')
    expect(declarationsIn('.cv-p-copyable').get('position')).toBe('relative')
  })

  it('gets borders instead of backgrounds under forced colors', () => {
    const forced = forcedColorsBody()
    expect(forced).toContain('.cv-p-copyable')
    expect(forced).toContain('.cv-p-text__pre')
    expect(declarationsIn('.cv-p-copyable', forced).get('border')).toBe('1px solid')
    expect(declarationsIn('.cv-p-copyable', forced).get('background')).toBe('none')
  })
})

describe('participant message text - hygiene', () => {
  const FILES = [
    'participantMessageFormat.ts',
    'participantMessageInline.ts',
    'participantMessageAtoms.ts',
    'participantMessageLinks.ts',
    'participantMessageCopyables.ts',
    'participantDocuments.ts',
    'ParticipantMessageText.tsx',
    'ParticipantMessageNodes.tsx',
    'ParticipantCopyableToken.tsx',
    'ParticipantCopyAnnouncer.tsx',
    'useParticipantCopyFeedback.ts',
  ] as const
  const sources = FILES.map((file) => ({ file, source: readFileSync(join(import.meta.dir, file), 'utf8') }))

  it('stays within 200 lines per file', () => {
    for (const { file, source } of sources) {
      expect({ file, ok: source.split('\n').length <= 200 }).toEqual({ file, ok: true })
    }
  })

  it('never sets inner HTML, never uses any, never reuses the shared MessageText', () => {
    for (const { source } of sources) {
      expect(source).not.toMatch(/innerHTML|dangerouslySetInnerHTML|:\s*any\b|as any|MessageText\b.*from '\.\.\//)
      expect(source).not.toContain('whatsapp-formatting')
    }
  })

  it('has no Tailwind utilities and no vocabulary from a specific product', () => {
    for (const { source } of sources) {
      expect(source).not.toMatch(/className="[^"]*\b(flex|grid|p-\d|m-\d|text-(sm|xs|lg)|bg-\w+)\b/)
      expect(source).not.toMatch(/\b(carga|entrega|frete|cte|nf-?e|transport\w*|motorista|viagem|trip|driver)\b/i)
    }
  })
})
