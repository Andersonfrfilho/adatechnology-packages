import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { buildConversation, buildMessage } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import type { ParticipantTimelineItem } from './participantMessages'
import { ParticipantThread, type ParticipantThreadProps } from './ParticipantThread'

const ITEMS: readonly ParticipantTimelineItem[] = [
  {
    kind: 'server',
    message: buildMessage({
      id: 'a',
      direction: 'inbound',
      authorName: 'Ana Souza',
      createdAt: '2026-10-01T10:00:00.000Z',
    }),
  },
  {
    kind: 'server',
    message: buildMessage({ id: 'b', direction: 'outbound', status: 'read', createdAt: '2026-10-01T10:05:00.000Z' }),
  },
  {
    kind: 'pending',
    origin: 'local',
    displayState: 'queued',
    pending: {
      clientMessageId: 'c',
      subject: { subjectType: 'invoice', subjectId: '1' },
      text: 'Waiting',
      createdAt: '2026-10-01T10:06:00.000Z',
      state: 'queued',
    },
  },
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
      status="ready"
      refresh={() => undefined}
      scroll={{ ref: { current: null }, onScroll: () => undefined }}
      newMessagesCount={0}
      isSending={false}
      {...overrides}
    />,
  )
}

function mineFlags(markup: string): boolean[] {
  return markup
    .split('<div class="cv-p-bubble')
    .slice(1)
    .map((bubble) => bubble.startsWith(' cv-p-bubble--mine'))
}

describe('ParticipantThread perspective', () => {
  it('is untouched without the new props: the participant owns the inbound messages', () => {
    expect(mineFlags(render())).toEqual([true, false, true])
    expect(render({ perspective: 'participant' })).toBe(render())
  })

  it('draws none of the new header parts without the new props', () => {
    const markup = render()
    expect(markup).not.toContain('cv-p-thread__actions')
    expect(markup).not.toContain('cv-p-thread__counterpart')
  })

  it('inverts which bubble is mine for the operator, keeping the own local pending message', () => {
    expect(mineFlags(render({ perspective: 'operator' }))).toEqual([false, true, true])
  })

  it('moves the ticks to the operator side', () => {
    const participant = render()
    const operator = render({ perspective: 'operator' })
    expect(participant).not.toContain('cv-status-ticks--read')
    expect(operator).toContain('cv-status-ticks--read')
    expect(operator).toContain('cv-status-ticks--queued')
  })

  it('puts the avatar on the counterpart, not on the operator', () => {
    const participant = render({ avatars: 'initials' })
    const operator = render({ perspective: 'operator', avatars: 'initials' })
    expect(participant).not.toContain('>AS<')
    expect(operator).toContain('class="cv-p-avatar" aria-hidden="true">AS<')
  })
})
