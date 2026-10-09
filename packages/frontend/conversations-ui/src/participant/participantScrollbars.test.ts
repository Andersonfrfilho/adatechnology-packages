import { describe, expect, it } from 'bun:test'

import { PARTICIPANT_CSS, declarationsIn, mediaBody, toRem } from './participantCss.test-helper'

const VERTICAL_AREAS = ['.cv-p-thread__scroll', '.cv-p-inbox', '.cv-p-composer__input']
const HORIZONTAL_STRIPS = ['.cv-p-filters', '.cv-p-quick']
const NO_PREFERENCE = '(prefers-reduced-motion: no-preference)'
const FORCED_COLORS = '(forced-colors: active)'
const WEBKIT_GUARD = 'not (forced-colors: active)'

function webkitRules(selector: string): Map<string, string> {
  return declarationsIn(`${selector}::-webkit-scrollbar`, mediaBody(WEBKIT_GUARD))
}

describe.each(VERTICAL_AREAS)('vertical scroller %s', (selector) => {
  const declarations = declarationsIn(selector)

  it('has a thin themed scrollbar from the tokens', () => {
    expect(declarations.get('scrollbar-width')).toBe('thin')
    expect(declarations.get('scrollbar-color')).toBe('var(--cv-p-i-scrollbar-thumb) transparent')
  })

  it('does not chain the scroll to the page', () => {
    expect(declarations.get('overscroll-behavior-y')).toBe('contain')
  })

  it('has a 6px track-less webkit scrollbar with a rounded thumb and no arrows', () => {
    expect(webkitRules(selector).get('width')).toBe('6px')
    expect(webkitRules(selector).get('height')).toBe('6px')
    const track = declarationsIn(`${selector}::-webkit-scrollbar-track`, mediaBody(WEBKIT_GUARD))
    expect(track.get('background')).toBe('transparent')
    const thumb = declarationsIn(`${selector}::-webkit-scrollbar-thumb`, mediaBody(WEBKIT_GUARD))
    expect(thumb.get('background-color')).toBe('var(--cv-p-i-scrollbar-thumb)')
    expect(thumb.get('border-radius')).toBe('var(--cv-p-i-radius)')
    const buttons = declarationsIn(`${selector}::-webkit-scrollbar-button`, mediaBody(WEBKIT_GUARD))
    expect(buttons.get('display')).toBe('none')
  })

  it('highlights the thumb with the accent on hover and drag', () => {
    const hover = declarationsIn(`${selector}::-webkit-scrollbar-thumb:hover`, mediaBody(WEBKIT_GUARD))
    const active = declarationsIn(`${selector}::-webkit-scrollbar-thumb:active`, mediaBody(WEBKIT_GUARD))
    expect(hover.get('background-color')).toBe('var(--cv-p-i-scrollbar-thumb-hover)')
    expect(active.get('background-color')).toBe('var(--cv-p-i-scrollbar-thumb-hover)')
  })

  it('goes back to the system scrollbar under forced colors', () => {
    const forced = declarationsIn(selector, mediaBody(FORCED_COLORS))
    expect(forced.get('scrollbar-color')).toBe('auto')
    expect(forced.get('scrollbar-width')).toBe('auto')
  })
})

describe('scrollbar tokens', () => {
  const root = declarationsIn('.cv-p')

  it('derive from the existing tokens and are overridable', () => {
    expect(root.get('--cv-p-i-scrollbar-thumb')).toBe('var(--cv-p-scrollbar-thumb, var(--cv-p-i-border))')
    expect(root.get('--cv-p-i-scrollbar-thumb-hover')).toBe('var(--cv-p-scrollbar-thumb-hover, var(--cv-p-i-accent))')
  })
})

describe('thread scrollbar does not move the bubbles', () => {
  it('reserves no gutter', () => {
    expect(declarationsIn('.cv-p-thread__scroll').get('scrollbar-gutter')).toBeUndefined()
    expect(declarationsIn('.cv-p-inbox').get('scrollbar-gutter')).toBeUndefined()
  })
})

describe.each(HORIZONTAL_STRIPS)('horizontal strip %s', (selector) => {
  const declarations = declarationsIn(selector)

  it('hides the scrollbar everywhere', () => {
    expect(declarations.get('scrollbar-width')).toBe('none')
    expect(declarationsIn(`${selector}::-webkit-scrollbar`).get('display')).toBe('none')
  })

  it('fades both edges to hint that it scrolls', () => {
    const mask = declarations.get('mask-image') ?? ''
    expect(mask).toContain('linear-gradient(to right')
    expect(mask).toContain('transparent')
    expect(declarations.get('-webkit-mask-image')).toBe(mask)
  })

  it('snaps with proximity and does not chain sideways', () => {
    expect(declarations.get('scroll-snap-type')).toBe('x proximity')
    expect(declarations.get('overscroll-behavior-x')).toBe('contain')
    expect(declarations.get('-webkit-overflow-scrolling')).toBe('touch')
  })

  it('keeps the first chip clear of the fade', () => {
    expect(declarations.get('scroll-padding-inline')).toBe('var(--cv-p-i-fade)')
    expect(declarations.get('padding-inline')).toBe('var(--cv-p-i-fade)')
    expect(toRem(declarationsIn(selector).get('--cv-p-i-fade'))).toBeGreaterThanOrEqual(0.75)
    expect(declarationsIn(`${selector} > .cv-p-chip`).get('scroll-snap-align')).toBe('start')
  })

  it('drops the mask under forced colors', () => {
    const forced = declarationsIn(selector, mediaBody(FORCED_COLORS))
    expect(forced.get('mask-image')).toBe('none')
    expect(forced.get('-webkit-mask-image')).toBe('none')
  })
})

describe('smooth scrolling', () => {
  const SMOOTH_AREAS = ['.cv-p-inbox', '.cv-p-filters', '.cv-p-quick']

  it.each(SMOOTH_AREAS)('%s is smooth only when motion is welcome', (selector) => {
    expect(declarationsIn(selector, mediaBody(NO_PREFERENCE)).get('scroll-behavior')).toBe('smooth')
    expect(declarationsIn(selector).get('scroll-behavior')).toBeUndefined()
  })

  it('never makes the thread scroller smooth: its programmatic positioning must stay instant', () => {
    expect(declarationsIn('.cv-p-thread__scroll').get('scroll-behavior')).toBeUndefined()
    expect(declarationsIn('.cv-p-thread__scroll', mediaBody(NO_PREFERENCE)).get('scroll-behavior')).toBeUndefined()
  })

  it('has no scroll-behavior outside the no-preference block', () => {
    const outside = PARTICIPANT_CSS.replace(mediaBody(NO_PREFERENCE) ?? '', '')
    expect(outside).not.toMatch(/(?<!over)scroll-behavior/)
  })
})

describe('scroll-to-latest button styles', () => {
  const button = declarationsIn('.cv-p-thread__latest-button')

  it('is a 44px touch target', () => {
    expect(button.get('width')).toBe('var(--cv-p-i-touch)')
    expect(button.get('height')).toBe('var(--cv-p-i-touch)')
    expect(toRem(declarationsIn('.cv-p').get('--cv-p-i-touch'))).toBeGreaterThanOrEqual(2.75)
  })

  it('floats without taking room in the scroller', () => {
    const anchor = declarationsIn('.cv-p-thread__latest')
    expect(anchor.get('position')).toBe('sticky')
    expect(anchor.get('bottom')).toBe('0')
    expect(anchor.get('height')).toBe('0')
    expect(button.get('position')).toBe('absolute')
  })

  it('animates its entrance only when motion is welcome', () => {
    expect(declarationsIn('.cv-p-thread__latest-button', mediaBody(NO_PREFERENCE)).get('animation')).toContain(
      'cv-p-latest-in',
    )
    expect(button.get('animation')).toBeUndefined()
  })

  it('outlines the badge under forced colors', () => {
    expect(declarationsIn('.cv-p-thread__latest-badge', mediaBody(FORCED_COLORS)).get('border')).toContain('ButtonText')
  })
})

describe('no leftovers', () => {
  it('uses no Tailwind and no host vocabulary in the new rules', () => {
    expect(PARTICIPANT_CSS).not.toMatch(/@apply|@tailwind/)
  })
})
