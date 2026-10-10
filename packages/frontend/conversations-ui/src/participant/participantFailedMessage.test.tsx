import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { OwnStatus, RetryButton } from './ParticipantBubbleStatus'
import { ParticipantFailedMenu } from './ParticipantFailedMenu'
import { declarationsIn } from './participantCss.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as LABELS } from './participantLabels'

const noop = (): void => undefined

describe('failed message: markup', () => {
  it('puts retry in a round icon button with the long text as its name, no visible text', () => {
    const markup = renderToStaticMarkup(<RetryButton labels={LABELS} onRetry={noop} />)

    expect(markup).toContain('aria-label="Failed — tap to retry"')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup.replace(/<svg.*<\/svg>/, '')).not.toMatch(/>[A-Za-z]/)
  })

  it('keeps the meta of a failed bubble to the red icon, with the short text for screen readers only', () => {
    const withRetry = renderToStaticMarkup(<OwnStatus status="failed" labels={LABELS} onRetry={noop} />)
    const withoutRetry = renderToStaticMarkup(<OwnStatus status="failed" labels={LABELS} />)

    expect(withRetry).not.toContain('<button')
    expect(withRetry).toContain('cv-status-ticks--failed')
    expect(withRetry).toContain('cv-p-sr-only">Failed<')
    expect(withoutRetry).toContain('cv-p-bubble__status-text">Failed<')
  })

  it('renders a closed menu trigger with the menu button semantics, and no menu without handlers', () => {
    const markup = renderToStaticMarkup(<ParticipantFailedMenu labels={LABELS} onEdit={noop} onDiscard={noop} />)

    expect(markup).toContain('aria-haspopup="menu"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('data-cv-tooltip="Message options"')
    expect(markup).toContain('aria-label="Message options"')
    expect(markup).not.toContain('role="menu"')
    expect(renderToStaticMarkup(<ParticipantFailedMenu labels={LABELS} />)).toBe('')
  })
})

describe('failed message: styles', () => {
  it('hangs the retry button beside the bubble: 44px target, 2rem circle, no layout space taken', () => {
    const button = declarationsIn('.cv-p-failed-retry')
    const icon = declarationsIn('.cv-p-failed-retry__icon')

    expect(button.get('position')).toBe('absolute')
    expect(button.get('right')).toContain('100%')
    expect(button.get('width')).toBe('var(--cv-p-i-touch)')
    expect(button.get('height')).toBe('var(--cv-p-i-touch)')
    expect(icon.get('width')).toBe('2rem')
    expect(icon.get('border-radius')).toBe('50%')
    expect(button.get('color')).toBe('var(--cv-p-i-danger)')
  })

  it('keeps the bubble cap of 85% by not wrapping the bubble in a row', () => {
    expect(declarationsIn('.cv-p-bubble-row--failed').size).toBe(0)
    expect(declarationsIn('.cv-p-bubble').get('max-width')).toBe('85%')
  })

  it('flips the menu below the bubble with a modifier', () => {
    expect(declarationsIn('.cv-p-failed-menu__list--below').get('top')).toContain('100%')
    expect(declarationsIn('.cv-p-failed-menu__list--below').get('bottom')).toBe('auto')
  })

  it('draws the menu with square corners, text and danger tokens, 44px items', () => {
    expect(declarationsIn('.cv-p-failed-menu__list').get('border-radius')).toBe('var(--cv-p-i-radius)')
    expect(declarationsIn('.cv-p-failed-menu__list').get('bottom')).toContain('100%')
    expect(declarationsIn('.cv-p-failed-menu__item').get('color')).toBe('var(--cv-p-i-text)')
    expect(declarationsIn('.cv-p-failed-menu__item').get('min-height')).toBe('var(--cv-p-i-touch)')
    expect(declarationsIn('.cv-p-failed-menu__item--danger').get('color')).toBe('var(--cv-p-i-danger)')
  })

  it('keeps the trigger hit area inside the bubble padding (0.5rem), never into other rows', () => {
    expect(declarationsIn('.cv-p-failed-menu__trigger::after').get('inset')).toBe('-0.5rem -0.4rem')
  })

  it('has no leftover action-row or bordered-retry rules', () => {
    for (const selector of ['.cv-p-bubble__retry', '.cv-p-bubble__action', '.cv-p-bubble__actions']) {
      expect(declarationsIn(selector).size).toBe(0)
    }
  })
})
