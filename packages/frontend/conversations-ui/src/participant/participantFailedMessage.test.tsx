import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { FailedActions, OwnStatus } from './ParticipantBubbleStatus'
import { declarationsIn } from './participantCss.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as LABELS } from './participantLabels'

const noop = (): void => undefined

function actions(handlers: { onRetry?: () => void; onEdit?: () => void; onDiscard?: () => void }): string {
  return renderToStaticMarkup(<FailedActions labels={LABELS} {...handlers} />)
}

describe('failed message: compact markup', () => {
  it('keeps retry, edit and discard in one row of text actions, retry first', () => {
    const markup = actions({ onRetry: noop, onEdit: noop, onDiscard: noop })

    expect(markup.match(/class="cv-p-bubble__actions"/g)).toHaveLength(1)
    expect(markup.indexOf('>Retry<') < markup.indexOf('>Edit<')).toBe(true)
    expect(markup.indexOf('>Edit<') < markup.indexOf('>Discard<')).toBe(true)
    expect(markup).toContain('aria-label="Failed — tap to retry"')
    expect(markup).toContain('aria-hidden="true"')
  })

  it('renders only the actions that have a handler, and nothing without any', () => {
    expect(actions({})).toBe('')
    expect(actions({ onEdit: noop })).not.toContain('Retry')
    expect(actions({ onRetry: noop })).not.toContain('Discard')
  })

  it('moves the long failure text out of the meta line when retry is in the action row', () => {
    const withRetry = renderToStaticMarkup(<OwnStatus status="failed" labels={LABELS} onRetry={noop} />)
    const withoutRetry = renderToStaticMarkup(<OwnStatus status="failed" labels={LABELS} />)

    expect(withRetry).not.toContain('<button')
    expect(withRetry).not.toContain('tap to retry')
    expect(withRetry).toContain('cv-status-ticks--failed')
    expect(withRetry).toContain('cv-p-sr-only">Failed<')
    expect(withoutRetry).toContain('cv-p-bubble__status-text">Failed<')
  })
})

describe('failed message: compact styles', () => {
  const retry = declarationsIn('.cv-p-bubble__action--retry')
  const action = declarationsIn('.cv-p-bubble__action')
  const row = declarationsIn('.cv-p-bubble__actions')

  it('draws the actions as plain text: no border, no fill', () => {
    expect(action.get('border')).toBe('0')
    expect(action.get('background')).toBe('transparent')
    expect(declarationsIn('.cv-p-bubble__retry').size).toBe(0)
  })

  it('takes the 44px touch target from the row itself, never from a pseudo-element', () => {
    expect(row.get('min-height')).toBe('var(--cv-p-i-touch)')
    expect(declarationsIn('.cv-p-bubble__action::after').size).toBe(0)
  })

  it('colors retry in the danger token and the rest in muted, both contrast-tested tokens', () => {
    expect(retry.get('color')).toBe('var(--cv-p-i-danger)')
    expect(action.get('color')).toBe('var(--cv-p-i-text-muted)')
    expect(declarationsIn('.cv-p-bubble__action:hover').get('text-decoration')).toBe('underline')
    expect(declarationsIn('.cv-p-bubble__action:focus-visible').get('text-decoration')).toBe('underline')
  })
})
