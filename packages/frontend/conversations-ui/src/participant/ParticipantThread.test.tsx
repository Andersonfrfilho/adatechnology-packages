import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { buildConversation, buildMessage, findForeignClassTokens, findUtilityClassTokens } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import type { ParticipantTimelineItem } from './participantMessages'
import { ParticipantThread, type ParticipantThreadProps } from './ParticipantThread'

const ITEMS: readonly ParticipantTimelineItem[] = [
  { kind: 'server', message: buildMessage({ id: 'a', createdAt: '2026-10-01T10:00:00.000Z' }) },
  { kind: 'server', message: buildMessage({ id: 'b', direction: 'inbound', createdAt: '2026-10-01T10:05:00.000Z' }) },
  { kind: 'server', message: buildMessage({ id: 'c', createdAt: '2026-10-02T09:00:00.000Z' }) },
]

function render(overrides: Partial<ParticipantThreadProps> = {}): string {
  return renderToStaticMarkup(
    <ParticipantThread
      conversation={buildConversation({ subjectId: '1', subjectLabel: 'Invoice 4521' })}
      items={ITEMS}
      hasMore={false}
      labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS}
      resolveAttachmentUrl={async () => 'https://files.example/a'}
      draft={{ value: '', onChange: () => undefined, files: [], onFilesChange: () => undefined }}
      onSend={() => undefined}
      {...overrides}
    />,
  )
}

describe('ParticipantThread', () => {
  it('renders the subject label as the title', () => {
    expect(render()).toContain('Invoice 4521')
  })

  it('renders the back button only with onBack', () => {
    expect(render()).not.toContain('cv-p-thread__back')
    expect(render({ onBack: () => undefined })).toContain('cv-p-thread__back')
  })

  it('makes the title clickable only with onOpenSubject', () => {
    expect(render()).not.toContain('cv-p-thread__title-button')
    expect(render({ onOpenSubject: () => undefined })).toContain('cv-p-thread__title-button')
  })

  it('draws nothing for the subject card slot when renderSubjectCard is absent', () => {
    expect(render()).not.toContain('cv-p-thread__subject-card')
    const markup = render({ renderSubjectCard: () => <p>Card body</p> })
    expect(markup).toContain('cv-p-thread__subject-card')
    expect(markup).toContain('Card body')
  })

  it('renders day dividers between days', () => {
    expect(render().match(/cv-p-day"/g)?.length).toBe(2)
  })

  it('has a polite live region that announces new messages', () => {
    const quiet = render()
    const loud = render({ newMessagesCount: 2 })

    expect(quiet).toContain('aria-live="polite"')
    expect(quiet).not.toContain('New messages')
    expect(loud).toContain('aria-live="polite"')
    expect(loud).toContain('New messages')
  })

  it('shows load older only when hasMore and onLoadOlder exist', () => {
    expect(render()).not.toContain('Load older messages')
    expect(render({ hasMore: true, onLoadOlder: () => undefined })).toContain('Load older messages')
  })

  it('shows the closed notice and no composer when the conversation is closed', () => {
    const markup = render({ conversation: buildConversation({ subjectId: '1', status: 'closed' }) })

    expect(markup).toContain('This conversation is closed')
    expect(markup).not.toContain('<form')
    expect(markup).not.toContain('<textarea')
  })

  it('shows the composer when the conversation is open', () => {
    const markup = render()

    expect(markup).toContain('<form')
    expect(markup).not.toContain('This conversation is closed')
  })

  it('renders quick replies only when given', () => {
    expect(render()).not.toContain('cv-p-quick')
    expect(render({ quickReplies: [{ id: '1', title: 'Hi', shortcut: 'hi', body: 'Hi' }] })).toContain('cv-p-quick')
  })

  it('uses only cv-p-* classes and no Tailwind utilities', () => {
    const markup = render({ onBack: () => undefined, hasMore: true, onLoadOlder: () => undefined })

    expect(findUtilityClassTokens(markup)).toEqual([])
    expect(findForeignClassTokens(markup)).toEqual([])
  })
})
