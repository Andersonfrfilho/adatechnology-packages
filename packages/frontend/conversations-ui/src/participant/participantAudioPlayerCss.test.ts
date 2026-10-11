import { describe, expect, it } from 'bun:test'

import { declarationsIn, PARTICIPANT_CSS } from './participantCss.test-helper'

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
