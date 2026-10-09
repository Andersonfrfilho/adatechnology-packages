import { describe, expect, it } from 'bun:test'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  buildConversation,
  buildMessage,
  findForeignClassTokens,
  findUtilityClassTokens,
} from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { ParticipantScrollToLatest } from './ParticipantScrollToLatest'
import { ParticipantThread, type ParticipantThreadProps } from './ParticipantThread'

const LABEL = DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS.scrollToLatest

function renderButton(overrides: Partial<Parameters<typeof ParticipantScrollToLatest>[0]> = {}): string {
  return renderToStaticMarkup(
    <ParticipantScrollToLatest
      label={LABEL}
      isAwayFromBottom
      hasMessages
      newMessagesCount={0}
      onClick={() => undefined}
      {...overrides}
    />,
  )
}

function renderThread(overrides: Partial<ParticipantThreadProps> = {}): string {
  return renderToStaticMarkup(
    <ParticipantThread
      conversation={buildConversation({ subjectId: '1' })}
      items={[{ kind: 'server', message: buildMessage({ id: 'a', createdAt: '2026-10-01T10:00:00.000Z' }) }]}
      hasMore={false}
      labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS}
      resolveAttachmentUrl={async () => 'https://files.example/a'}
      draft={{ value: '', onChange: () => undefined, files: [], onFilesChange: () => undefined }}
      onSend={() => undefined}
      status="ready"
      refresh={() => undefined}
      scroll={{
        ref: { current: null },
        onScroll: () => undefined,
        isAwayFromBottom: true,
        scrollToLatest: () => undefined,
      }}
      newMessagesCount={0}
      isSending={false}
      {...overrides}
    />,
  )
}

describe('ParticipantScrollToLatest', () => {
  it('has a generic English default label', () => {
    expect(LABEL).toBe('Scroll to latest message')
  })

  it('draws nothing near the end of the conversation', () => {
    expect(renderButton({ isAwayFromBottom: false })).toBe('')
  })

  it('draws nothing without messages', () => {
    expect(renderButton({ hasMessages: false })).toBe('')
  })

  it('is a named button that does not submit anything', () => {
    const markup = renderButton()
    expect(markup).toContain(`aria-label="${LABEL}"`)
    expect(markup).toContain('type="button"')
    expect(markup).toContain('class="cv-p-thread__latest-button"')
  })

  it('keeps the icon decorative', () => {
    expect(renderButton()).toContain('aria-hidden="true"')
  })

  it('shows the count of new incoming messages in a badge hidden from the accessibility tree', () => {
    expect(renderButton({ newMessagesCount: 3 })).toContain(
      '<span class="cv-p-thread__latest-badge" aria-hidden="true">3</span>',
    )
  })

  it('has no badge with zero new messages', () => {
    expect(renderButton({ newMessagesCount: 0 })).not.toContain('cv-p-thread__latest-badge')
  })

  it('has the aria-label exactly as the label, without the count', () => {
    expect(renderButton({ newMessagesCount: 3 })).toContain(`aria-label="${LABEL}"`)
  })
})

describe('ParticipantScrollToLatest focus', () => {
  it('moves focus to the scroller before scrolling, since the button unmounts on click', () => {
    const order: string[] = []
    const root = ParticipantScrollToLatest({
      label: LABEL,
      isAwayFromBottom: true,
      hasMessages: true,
      newMessagesCount: 0,
      onClick: () => void order.push('scroll'),
    }) as ReactElement<{ children: ReactElement<{ onClick: (event: unknown) => void }> }>
    const button = root.props.children
    button.props.onClick({
      currentTarget: { closest: () => ({ focus: () => void order.push('focus') }) },
    })
    expect(order).toEqual(['focus', 'scroll'])
  })

  it('makes the scroller focusable by script only', () => {
    expect(renderThread()).toMatch(/<div class="cv-p-thread__scroll" tabindex="-1">/)
  })
})

describe('ParticipantThread with the scroll-to-latest button', () => {
  it('draws the button inside the scroller, after the messages', () => {
    const markup = renderThread()
    const scroller = markup.indexOf('cv-p-thread__scroll')
    expect(markup.indexOf('cv-p-thread__latest-button')).toBeGreaterThan(markup.indexOf('cv-p-thread__messages'))
    expect(markup.indexOf('cv-p-thread__latest-button')).toBeGreaterThan(scroller)
    expect(markup.indexOf('cv-p-thread__latest-button')).toBeLessThan(markup.indexOf('cv-p-thread__live'))
  })

  it('does not draw it while the reader is at the end', () => {
    const scroll = { ref: { current: null }, onScroll: () => undefined, isAwayFromBottom: false }
    expect(renderThread({ scroll })).not.toContain('cv-p-thread__latest')
  })

  it('does not draw it for a host that gives no away state', () => {
    expect(renderThread({ scroll: { ref: { current: null }, onScroll: () => undefined } })).not.toContain(
      'cv-p-thread__latest',
    )
  })

  it('announces only the new-messages label, never the count or the button label', () => {
    const markup = renderThread({ newMessagesCount: 2 })
    expect(markup).toContain('role="status" aria-live="polite">New messages</div>')
    expect(markup.split('New messages').length - 1).toBe(1)
    expect(markup.match(/aria-live/g)).toHaveLength(1)
  })

  it('lets the host translate the label', () => {
    const labels = { ...DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS, scrollToLatest: 'Ir para a última mensagem' }
    expect(renderThread({ labels })).toContain('aria-label="Ir para a última mensagem"')
  })

  it('stays inside the participant namespace with no utility classes', () => {
    const markup = renderThread({ newMessagesCount: 2 })
    expect(findUtilityClassTokens(markup)).toEqual([])
    expect(findForeignClassTokens(markup)).toEqual([])
  })
})
