import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { declarationsIn, toRem } from './participantCss.test-helper'
import { buildConversation } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { ParticipantThreadHeader, type ParticipantThreadHeaderProps } from './ParticipantThreadHeader'

const LABELS = DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS

function render(overrides: Partial<ParticipantThreadHeaderProps> = {}): string {
  return renderToStaticMarkup(
    <ParticipantThreadHeader
      conversation={buildConversation({ subjectId: '1', subjectLabel: 'Item 4521' })}
      labels={LABELS}
      {...overrides}
    />,
  )
}

function backButtonOf(markup: string): string {
  const start = markup.indexOf('<button')
  return markup.slice(start, markup.indexOf('</button>', start))
}

describe('back button', () => {
  const markup = render({ onBack: () => undefined })

  it('is an icon with the back label as its accessible name and no visible text or glyph', () => {
    const button = backButtonOf(markup)
    expect(button).toContain('class="cv-p-thread__back"')
    expect(button).toContain('aria-label="Back"')
    expect(button).toContain('<svg')
    expect(button.replace(/<[^>]+>/g, '')).toBe('')
    expect(markup).not.toContain('‹')
  })

  it('is not the boxed secondary button any more', () => {
    expect(markup).not.toContain('cv-p-button')
    const back = declarationsIn('.cv-p-thread__back')
    expect(back.get('border')).toBe('0')
    expect(back.get('background')).toBe('transparent')
  })

  it('has a 44px touch area and keeps the focus ring', () => {
    const back = declarationsIn('.cv-p-thread__back')
    expect(back.get('min-width')).toBe('var(--cv-p-i-touch)')
    expect(back.get('min-height')).toBe('var(--cv-p-i-touch)')
    expect(declarationsIn('.cv-p :focus-visible').get('outline')).toContain('2px solid')
  })

  it('is absent without onBack', () => {
    expect(render()).not.toContain('<button')
  })

  it('comes first, before the avatar and the title block', () => {
    const withIcon = render({ onBack: () => undefined, renderSubjectIcon: () => <i /> })
    expect(withIcon.indexOf('cv-p-thread__back')).toBeLessThan(withIcon.indexOf('cv-p-thread__avatar'))
    expect(withIcon.indexOf('cv-p-thread__avatar')).toBeLessThan(withIcon.indexOf('cv-p-thread__heading'))
  })
})

describe('conversation avatar', () => {
  const group = { subjectType: 'invoice', label: 'Invoices', icon: <i>group</i> }

  it('uses the host icon over the group icon', () => {
    const markup = render({ subjectGroups: [group], renderSubjectIcon: () => <b>host</b> })
    expect(markup).toContain('<span class="cv-p-thread__avatar" aria-hidden="true"><b>host</b></span>')
    expect(markup).not.toContain('<i>group</i>')
  })

  it('falls back to the group icon when the host draws nothing', () => {
    const markup = render({ subjectGroups: [group], renderSubjectIcon: () => null })
    expect(markup).toContain('<span class="cv-p-thread__avatar" aria-hidden="true"><i>group</i></span>')
  })

  it('is absent without any icon, and the group label takes its place as the eyebrow', () => {
    const markup = render({ subjectGroups: [{ subjectType: 'invoice', label: 'Invoices' }] })
    expect(markup).not.toContain('cv-p-thread__avatar')
    expect(markup).toContain('<p class="cv-p-thread__eyebrow">Invoices</p>')
    expect(render()).not.toContain('cv-p-thread__avatar')
  })

  it('replaces the eyebrow: the tile stands for the group', () => {
    expect(render({ subjectGroups: [group] })).not.toContain('cv-p-thread__eyebrow')
  })

  it('is a 2.5rem tile that follows the radius token', () => {
    const avatar = declarationsIn('.cv-p-thread__avatar')
    expect(toRem(avatar.get('width'))).toBe(2.5)
    expect(toRem(avatar.get('height'))).toBe(2.5)
    expect(avatar.get('border-radius')).toBe('var(--cv-p-i-radius)')
    expect(avatar.get('flex')).toBe('0 0 auto')
  })
})

describe('bar', () => {
  it('is a raised surface with a 1px bottom border and a 4rem floor', () => {
    const header = declarationsIn('.cv-p-thread__header')
    expect(header.get('background')).toBe('var(--cv-p-i-surface-raised)')
    expect(header.get('border-bottom')).toBe('1px solid var(--cv-p-i-border)')
    expect(header.get('align-items')).toBe('center')
  })

  it('lets the title block shrink so nothing overflows at 320px', () => {
    const heading = declarationsIn('.cv-p-thread__heading')
    expect(heading.get('min-width')).toBe('0')
    expect(declarationsIn('.cv-p-thread__meta').get('flex-wrap')).toBe('wrap')
    expect(declarationsIn('.cv-p-thread__title-text').get('text-overflow')).toBe('ellipsis')
  })
})
