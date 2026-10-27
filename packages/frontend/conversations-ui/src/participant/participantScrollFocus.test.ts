import { describe, expect, it } from 'bun:test'

import { SCROLLER_SELECTOR, focusScrollerOf } from './participantScrollFocus'

describe('focusScrollerOf', () => {
  it('moves focus to the scroller ancestor without scrolling it', () => {
    const calls: unknown[] = []
    const selectors: string[] = []
    focusScrollerOf({
      closest: (selector) => {
        selectors.push(selector)
        return { focus: (options) => void calls.push(options) }
      },
    })
    expect(selectors).toEqual([SCROLLER_SELECTOR])
    expect(calls).toEqual([{ preventScroll: true }])
  })

  it('does nothing when there is no scroller', () => {
    expect(() => focusScrollerOf({ closest: () => null })).not.toThrow()
  })
})
