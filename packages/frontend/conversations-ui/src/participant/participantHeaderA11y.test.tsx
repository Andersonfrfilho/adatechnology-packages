import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { declarationsIn, mediaBody, toRem } from './participantCss.test-helper'
import { buildConversation } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { ParticipantThreadHeader } from './ParticipantThreadHeader'

function render(onOpenSubject?: () => void): string {
  return renderToStaticMarkup(
    <ParticipantThreadHeader
      conversation={buildConversation({ subjectId: '1', subjectLabel: 'Invoice 4521', protocol: 'CV-2026-0001' })}
      labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS}
      onOpenSubject={onOpenSubject}
    />,
  )
}

describe('clickable title focus ring', () => {
  it('clamps the text in one inner span, inside the button and inside the plain heading', () => {
    expect(render(() => undefined)).toMatch(
      /<button[^>]*cv-p-thread__title-button[^>]*><span class="cv-p-thread__title-text">Invoice 4521<\/span><\/button>/,
    )
    expect(render()).toContain(
      '<h2 class="cv-p-thread__title"><span class="cv-p-thread__title-text">Invoice 4521</span></h2>',
    )
  })

  it('puts the only clamp on the inner span', () => {
    const text = declarationsIn('.cv-p-thread__title-text')
    expect(text.get('-webkit-line-clamp')).toBe('2')
    expect(text.get('overflow')).toBe('hidden')
    for (const selector of ['.cv-p-thread__title', '.cv-p-thread__title-button']) {
      expect(declarationsIn(selector).has('-webkit-line-clamp')).toBe(false)
    }
  })

  it('never clips the outline: no ancestor of the button hides overflow', () => {
    const ancestors = [
      '.cv-p-thread__title',
      '.cv-p-thread__title-button',
      '.cv-p-thread__heading',
      '.cv-p-thread__header',
    ]
    for (const selector of ancestors) {
      const overflow = declarationsIn(selector).get('overflow')
      expect(overflow === undefined || overflow === 'visible').toBe(true)
    }
  })
})

describe('copy touch area', () => {
  it('is at least 2.75rem wide and 2rem tall', () => {
    const copy = declarationsIn('.cv-p-protocol__copy')
    expect(toRem(copy.get('min-width'))).toBeGreaterThanOrEqual(2.75)
    expect(toRem(copy.get('min-height'))).toBeGreaterThanOrEqual(2)
  })

  it('extends above the button no further than the padding the meta line reserves', () => {
    const negativeTop = Math.abs(
      Math.min(0, toRem(declarationsIn('.cv-p-protocol__copy').get('margin')?.split(/\s+/)[0])),
    )
    const reservedTop = toRem(declarationsIn('.cv-p-thread__meta').get('padding-top'))
    expect(negativeTop).toBeGreaterThan(0)
    expect(negativeTop).toBeLessThanOrEqual(reservedTop)
  })
})

describe('bubble tail in forced colors and print', () => {
  it('drops both triangles and restores the radius under forced-colors', () => {
    const body = mediaBody('(forced-colors: active)') ?? ''
    expect(body).not.toBe('')
    const tails = declarationsIn('.cv-p-bubble::before', body)
    expect(tails.get('content')).toBe('none')
    expect(declarationsIn('.cv-p-bubble::after', body).get('content')).toBe('none')
    expect(declarationsIn('.cv-p-bubble', body).get('border-radius')).toBe('var(--cv-p-i-radius)')
    expect(declarationsIn('.cv-p-bubble--mine', body).get('border-radius')).toBe('var(--cv-p-i-radius)')
  })

  it('drops both triangles when printing', () => {
    const body = mediaBody('print') ?? ''
    expect(declarationsIn('.cv-p-bubble::before', body).get('content')).toBe('none')
    expect(declarationsIn('.cv-p-bubble::after', body).get('content')).toBe('none')
  })
})
