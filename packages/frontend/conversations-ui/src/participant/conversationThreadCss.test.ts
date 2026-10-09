import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

import { declarationsIn, mediaBody, PARTICIPANT_CSS } from './participantCss.test-helper'

const NEW_SOURCES = [
  'ConversationThread.tsx',
  'conversationThreadApi.ts',
  'conversationThreadSummary.ts',
  'participantPerspective.ts',
  'useParticipantUnread.ts',
  'useParticipantThreadController.ts',
].map((file) => ({ file, source: readFileSync(join(import.meta.dir, file), 'utf8') }))

describe('header additions', () => {
  it('puts the counterpart line in one muted, ellipsized line', () => {
    const rule = declarationsIn('.cv-p-thread__counterpart')
    expect(rule.get('color')).toBe('var(--cv-p-i-text-muted)')
    expect(rule.get('white-space')).toBe('nowrap')
    expect(rule.get('text-overflow')).toBe('ellipsis')
  })

  it('keeps the host actions at the end of the bar without ever shrinking', () => {
    const rule = declarationsIn('.cv-p-thread__actions')
    expect(rule.get('flex')).toBe('0 0 auto')
    expect(rule.get('margin-inline-start')).toBe('auto')
  })
})

describe('ticks', () => {
  it('take their color from package tokens that a host can override, with a fallback', () => {
    const root = declarationsIn('.cv-p')
    expect(root.get('--cv-p-i-tick')).toBe('var(--cv-p-tick, var(--cv-p-i-text-muted))')
    expect(root.get('--cv-p-i-tick-read')).toMatch(/^var\(--cv-p-tick-read, #[0-9a-f]{6}\)$/)
    expect(declarationsIn('.dark .cv-p').get('--cv-p-i-tick-read')).toMatch(/^var\(--cv-p-tick-read, #[0-9a-f]{6}\)$/)
  })

  it('override the shared tick colors only inside the participant bubble', () => {
    expect(declarationsIn('.cv-p-bubble .cv-status-ticks--sent').get('color')).toBe('var(--cv-p-i-tick)')
    expect(declarationsIn('.cv-p-bubble .cv-status-ticks--delivered').get('color')).toBe('var(--cv-p-i-tick)')
    expect(declarationsIn('.cv-p-bubble .cv-status-ticks--read').get('color')).toBe('var(--cv-p-i-tick-read)')
    expect(declarationsIn('.cv-p-bubble .cv-status-ticks--failed').get('color')).toBe('var(--cv-p-i-danger)')
    expect(declarationsIn('.cv-status-ticks--read').get('color')).toBe('rgb(14 165 233)')
  })

  it('give way to the system colors under forced-colors', () => {
    const forced = mediaBody('(forced-colors: active)') ?? ''
    expect(forced).toContain('.cv-p-bubble .cv-status-ticks')
    expect(declarationsIn('.cv-p-bubble .cv-status-ticks', forced).get('color')).toBe('CanvasText')
  })
})

describe('wallpaper and the strips around it', () => {
  it('gives the load error a solid panel so no text depends on the dots', () => {
    expect(declarationsIn('.cv-p-thread__scroll > .cv-p-error').get('background')).toBe('var(--cv-p-i-surface)')
  })

  it('paints the live strip like the composer it sits on', () => {
    expect(declarationsIn('.cv-p-thread__live').get('background')).toBe('var(--cv-p-i-surface-raised)')
  })

  it('keeps the wallpaper off under forced-colors', () => {
    expect(
      declarationsIn('.cv-p-thread__scroll', mediaBody('(forced-colors: active)') ?? '').get('background-image'),
    ).toBe('none')
  })
})

describe('motion', () => {
  it('adds no transition or animation outside the no-preference block', () => {
    const rules = declarationsIn('.cv-p-thread__actions')
    const counterpart = declarationsIn('.cv-p-thread__counterpart')
    for (const declarations of [rules, counterpart]) {
      expect(
        [...declarations.keys()].some(
          (property) => property.startsWith('transition') || property.startsWith('animation'),
        ),
      ).toBe(false)
    }
    expect(mediaBody('(prefers-reduced-motion: no-preference)')).toBeDefined()
  })
})

describe('new sources', () => {
  it('use no Tailwind utilities and none of the vocabulary of a specific product', () => {
    for (const { file, source } of NEW_SOURCES) {
      expect(source, file).not.toMatch(/className="[^"]*\b(flex|grid|p-\d|m-\d|text-(sm|xs|lg)|bg-\w+)\b/)
      expect(source, file).not.toMatch(
        /\b(nota|ocorr\w+|motorista|viagem|carga|entrega|frete|cte|nf-?e|transport\w*|trip|driver)\b/i,
      )
    }
  })

  it('stay under 200 lines and use no any', () => {
    for (const { file, source } of NEW_SOURCES) {
      expect(source.split('\n').length, file).toBeLessThanOrEqual(200)
      expect(source, file).not.toMatch(/:\s*any\b|\bas any\b|<any>/)
    }
  })

  it('declare the new tokens in the public theming comment', () => {
    const raw = readFileSync(join(import.meta.dir, '..', 'styles.css'), 'utf8')
    expect(raw).toContain('--cv-p-tick, --cv-p-tick-read')
    expect(PARTICIPANT_CSS).toContain('--cv-p-i-tick-read')
  })
})
