import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { findForeignClassTokens, findUtilityClassTokens, buildMessage } from './participantFixtures.test-helper'
import type { ParticipantTimelineItem } from './participantMessages'
import { ParticipantMessageBubble } from './ParticipantMessageBubble'

const LABELS = DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS
const resolveAttachmentUrl = async (): Promise<string> => 'https://files.example/a.png'

function renderServer(message = buildMessage({ id: 'm1' }), extra: { onRetry?: () => void; confirmsRead?: boolean } = {}): string {
  const item: ParticipantTimelineItem = { kind: 'server', message }
  return renderToStaticMarkup(
    <ParticipantMessageBubble
      item={item}
      labels={LABELS}
      confirmsRead={extra.confirmsRead ?? true}
      resolveAttachmentUrl={resolveAttachmentUrl}
      onRetry={extra.onRetry}
    />,
  )
}

function renderPending(
  displayState: 'sending' | 'queued' | 'failed',
  onRetry?: () => void,
  extra: { onDiscard?: () => void; onEdit?: () => void } = {},
): string {
  const item: ParticipantTimelineItem = {
    kind: 'pending',
    origin: 'host',
    displayState,
    pending: {
      clientMessageId: 'c1',
      subject: { subjectType: 'invoice', subjectId: '1' },
      text: 'Draft text',
      createdAt: '2026-10-01T10:00:00.000Z',
      state: displayState === 'sending' ? 'failed' : displayState,
    },
  }
  return renderToStaticMarkup(
    <ParticipantMessageBubble
      item={item}
      labels={LABELS}
      confirmsRead
      resolveAttachmentUrl={resolveAttachmentUrl}
      onRetry={onRetry}
      onDiscard={extra.onDiscard}
      onEdit={extra.onEdit}
    />,
  )
}

describe('ParticipantMessageBubble', () => {
  it('puts an inbound message on the own side and an outbound one on the other', () => {
    expect(renderServer(buildMessage({ id: 'a', direction: 'inbound' }))).toContain('cv-p-bubble--mine')
    expect(renderServer(buildMessage({ id: 'b', direction: 'outbound' }))).not.toContain('cv-p-bubble--mine')
  })

  it('shows the author name only when the message is not mine', () => {
    const theirs = renderServer(buildMessage({ id: 'a', direction: 'outbound', authorName: 'Marina' }))
    const mine = renderServer(buildMessage({ id: 'b', direction: 'inbound', authorName: 'Marina' }))

    expect(theirs).toContain('Marina')
    expect(mine).not.toContain('Marina')
  })

  it('renders a time element with the ISO dateTime', () => {
    expect(renderServer()).toMatch(/<time[^>]*dateTime="2026-10-01T10:00:00.000Z"/)
  })

  it.each([
    ['sent', 'cv-status-ticks--sent', 'Sent'],
    ['delivered', 'cv-status-ticks--delivered', 'Delivered'],
    ['read', 'cv-status-ticks--read', 'Read'],
  ] as const)('shows the %s status on my message with accessible text', (status, ticksClass, text) => {
    const markup = renderServer(buildMessage({ id: 'a', direction: 'inbound', status }))

    expect(markup).toContain(ticksClass)
    expect(markup).toContain(text)
  })

  it('downgrades read to delivered when the channel does not confirm reads', () => {
    const markup = renderServer(buildMessage({ id: 'a', direction: 'inbound', status: 'read' }), { confirmsRead: false })

    expect(markup).toContain('cv-status-ticks--delivered')
    expect(markup).not.toContain('cv-status-ticks--read')
  })

  it('shows no status on the other side', () => {
    expect(renderServer(buildMessage({ id: 'a', direction: 'outbound', status: 'read' }))).not.toContain('cv-status-ticks')
  })

  it('renders pending sending and queued with their texts', () => {
    expect(renderPending('sending')).toContain('Sending')
    const queued = renderPending('queued')
    expect(queued).toContain('Queued — sends when back online')
    expect(queued).toContain('cv-status-ticks--queued')
  })

  it('renders the retry button only for failed with onRetry', () => {
    const withRetry = renderPending('failed', () => undefined)
    const withoutRetry = renderPending('failed')

    expect(withRetry).toContain('<button')
    expect(withRetry).toContain('Failed — tap to retry')
    expect(withoutRetry).not.toContain('<button')
    expect(withoutRetry).toContain('cv-status-ticks--failed')
  })

  it('shows discard and edit on a failed pending only when the handlers exist', () => {
    const none = renderPending('failed')
    const both = renderPending('failed', () => undefined, { onDiscard: () => undefined, onEdit: () => undefined })
    const notFailed = renderPending('queued', undefined, { onDiscard: () => undefined, onEdit: () => undefined })

    expect(none).not.toContain('cv-p-bubble__action')
    expect(both).toContain('>Discard<')
    expect(both).toContain('>Edit<')
    expect(notFailed).not.toContain('cv-p-bubble__action')
  })

  it('a failed server message shows only "Failed", with no button', () => {
    const markup = renderServer(buildMessage({ id: 'a', direction: 'inbound', status: 'failed' }))

    expect(markup).toContain('Failed')
    expect(markup).not.toContain('<button')
  })

  it('renders attachments by kind: audio controls, image alt, document link', () => {
    const message = buildMessage({
      id: 'a',
      text: null,
      attachments: [
        { id: '1', kind: 'audio', filename: 'voice.ogg', mimeType: 'audio/ogg', sizeBytes: 10 },
        { id: '2', kind: 'image', filename: 'photo.png', mimeType: 'image/png', sizeBytes: 10 },
        { id: '3', kind: 'document', filename: 'note.pdf', mimeType: 'application/pdf', sizeBytes: 2048 },
      ],
    })
    const markup = renderServer(message)

    expect(markup).toContain('photo.png')
    expect(markup).toContain('note.pdf')
    expect(markup).toContain('voice.ogg')
    expect(markup).toContain('cv-p-attachment--image')
    expect(markup).toContain('cv-p-attachment--audio')
    expect(markup).toContain('cv-p-attachment--document')
  })

  it('uses only cv-p-* classes and no Tailwind utilities', () => {
    const markup = renderServer(buildMessage({ id: 'a', direction: 'inbound', status: 'read' }))

    expect(findUtilityClassTokens(markup)).toEqual([])
    expect(findForeignClassTokens(markup)).toEqual([])
    expect(markup).toContain('cv-p-')
  })
})
