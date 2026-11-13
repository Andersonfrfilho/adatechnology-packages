import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

import { resolveScrollToLatestView, scrollIntoViewOptions, scrollToLatestOptions } from './participantScrollView'

describe('resolveScrollToLatestView', () => {
  it('is hidden while the reader is near the end', () => {
    expect(resolveScrollToLatestView({ isAwayFromBottom: false, newMessagesCount: 0, hasMessages: true })).toEqual({
      isVisible: false,
      badge: undefined,
    })
  })

  it('is hidden when there is nothing to scroll to', () => {
    expect(
      resolveScrollToLatestView({ isAwayFromBottom: true, newMessagesCount: 0, hasMessages: false }).isVisible,
    ).toBe(false)
  })

  it('is visible without a badge when away and nothing new arrived', () => {
    expect(resolveScrollToLatestView({ isAwayFromBottom: true, newMessagesCount: 0, hasMessages: true })).toEqual({
      isVisible: true,
      badge: undefined,
    })
  })

  it('carries the count of new incoming messages as the badge', () => {
    expect(resolveScrollToLatestView({ isAwayFromBottom: true, newMessagesCount: 3, hasMessages: true }).badge).toBe(
      '3',
    )
  })

  it('caps a large count', () => {
    expect(resolveScrollToLatestView({ isAwayFromBottom: true, newMessagesCount: 100, hasMessages: true }).badge).toBe(
      '99+',
    )
    expect(resolveScrollToLatestView({ isAwayFromBottom: true, newMessagesCount: 99, hasMessages: true }).badge).toBe(
      '99',
    )
  })
})

describe('scroll options', () => {
  it('scrolls to the end of the list, smooth only without reduced motion', () => {
    expect(scrollToLatestOptions({ scrollHeight: 900, isReducedMotion: false })).toEqual({
      top: 900,
      behavior: 'smooth',
    })
    expect(scrollToLatestOptions({ scrollHeight: 900, isReducedMotion: true })).toEqual({ top: 900, behavior: 'auto' })
  })

  it('reveals the active chip with the nearest rule and no animation under reduced motion', () => {
    expect(scrollIntoViewOptions(false)).toEqual({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    expect(scrollIntoViewOptions(true)).toEqual({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  })
})

describe('the near-the-end threshold has one owner', () => {
  it('is declared only in participantScroll.ts', () => {
    const sources = readdirSync(import.meta.dir).filter(
      (name) => /\.tsx?$/.test(name) && !/\.test(-helper)?\.tsx?$/.test(name),
    )
    const declaring = sources.filter((name) =>
      /NEAR_BOTTOM_THRESHOLD_PX\s*=/.test(readFileSync(join(import.meta.dir, name), 'utf8')),
    )
    expect(declaring).toEqual(['participantScroll.ts'])
  })

  it('is not re-derived by the scroll-to-latest rule', () => {
    const source = readFileSync(join(import.meta.dir, 'participantScrollView.ts'), 'utf8')
    expect(source).not.toMatch(/scrollTop|clientHeight|threshold/i)
  })
})
