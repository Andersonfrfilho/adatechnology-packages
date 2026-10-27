import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'bun:test'

import { declarationsIn, mediaBody, PARTICIPANT_CSS } from './participantCss.test-helper'

describe('player styles (.cv-p-audio*)', () => {
  it('keeps both buttons and the bar at the touch size, from the existing tokens', () => {
    for (const selector of ['.cv-p-audio__seek']) expect(declarationsIn(selector).get('min-height')).toBe('var(--cv-p-i-touch)')
    expect(PARTICIPANT_CSS).toContain('min-width: var(--cv-p-i-touch); min-height: var(--cv-p-i-touch)')
  })

  it('has a width floor that never exceeds the bubble, so the play button stays visible at 375 px', () => {
    expect(declarationsIn('.cv-p-audio').get('min-width')).toBe('min(15rem, 100%)')
  })

  it('does not draw the media element and defines no utility-class dependency', () => {
    expect(declarationsIn('.cv-p-audio__media').get('display')).toBe('none')
    expect(PARTICIPANT_CSS).not.toMatch(/@apply|\btw-/)
  })
})

describe('transcription styles (.cv-p-transcription*)', () => {
  it('clamps the text at six lines and keeps it selectable', () => {
    const text = declarationsIn('.cv-p-transcription__text')
    expect(text.get('-webkit-line-clamp')).toBe('6')
    expect(text.get('user-select')).toBe('text')
    expect(declarationsIn(".cv-p-transcription__text[data-expanded='true']").get('overflow')).toBe('visible')
  })

  it('gives the see-all button the touch size and a forced-colors outline, from existing tokens', () => {
    const toggle = declarationsIn('.cv-p-transcription__toggle')
    expect(toggle.get('min-height')).toBe('var(--cv-p-i-touch)')
    expect(toggle.get('min-width')).toBe('var(--cv-p-i-touch)')
    expect(mediaBody('(forced-colors: active)')).toContain('.cv-p-transcription__toggle')
  })

  it('has no motion, so reduced-motion is respected by construction', () => {
    expect(PARTICIPANT_CSS).not.toMatch(/\.cv-p-transcription[^{]*\{[^}]*(transition|animation)/)
  })

  it('uses only existing tokens and no utility-class dependency', () => {
    const rules = PARTICIPANT_CSS.split('\n').filter((line) => line.startsWith('.cv-p-transcription'))
    expect(rules.length).toBeGreaterThan(5)
    for (const variable of rules.join('\n').match(/var\(--cv-p-i-[a-z-]+\)/g) ?? []) {
      expect(PARTICIPANT_CSS).toContain(`${variable.slice(4, -1)}:`)
    }
    expect(rules.join('\n')).not.toMatch(/@apply|\btw-/)
  })
})

describe('no dead audio selectors', () => {
  it('every .cv-p-recorder*, .cv-p-audio* and .cv-p-transcription* class is rendered by a component', () => {
    const sources = readdirSync(import.meta.dir)
      .filter((name) => name.endsWith('.tsx') && !name.includes('.test'))
      .map((name) => readFileSync(join(import.meta.dir, name), 'utf8'))
      .join('\n')
    const classNames = new Set(PARTICIPANT_CSS.match(/\.cv-p-(?:recorder|audio|transcription)[a-z_-]*/g) ?? [])
    expect(classNames.size).toBeGreaterThan(10)
    for (const selector of classNames) expect(sources).toContain(selector.slice(1))
  })
})
