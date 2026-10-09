import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { buildConversation, buildMessage } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import type { ParticipantTimelineItem } from './participantMessages'
import { ParticipantThread } from './ParticipantThread'

function ana(id: string, createdAt: string): ParticipantTimelineItem {
  return { kind: 'server', message: buildMessage({ id, authorName: 'Ana Souza', createdAt }) }
}

function mine(id: string, createdAt: string): ParticipantTimelineItem {
  return { kind: 'server', message: buildMessage({ id, direction: 'inbound', authorName: 'Ana Souza', createdAt }) }
}

function render(items: readonly ParticipantTimelineItem[]): string {
  return renderToStaticMarkup(
    <ParticipantThread
      conversation={buildConversation({ subjectId: '1' })}
      items={items}
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
      avatars="initials"
    />,
  )
}

function countAvatars(markup: string): number {
  return markup.match(/class="cv-p-avatar" aria-hidden="true">AS</g)?.length ?? 0
}

describe('avatar sequence in the thread', () => {
  it('shows one avatar for consecutive messages of the same author', () => {
    const markup = render([ana('a', '2026-10-01T10:00:00.000Z'), ana('b', '2026-10-01T10:01:00.000Z')])
    expect(countAvatars(markup)).toBe(1)
  })

  it('shows the avatar again after an own message of the same author in between', () => {
    const markup = render([
      ana('a', '2026-10-01T10:00:00.000Z'),
      mine('b', '2026-10-01T10:01:00.000Z'),
      ana('c', '2026-10-01T10:02:00.000Z'),
    ])
    expect(countAvatars(markup)).toBe(2)
  })

  it('shows the avatar again after the day separator', () => {
    const markup = render([ana('a', '2026-10-01T10:00:00.000Z'), ana('b', '2026-10-03T10:00:00.000Z')])
    expect(markup).toContain('role="separator"')
    expect(countAvatars(markup)).toBe(2)
  })

  it('never draws the avatar on own messages', () => {
    expect(render([mine('a', '2026-10-01T10:00:00.000Z')])).not.toContain('cv-p-avatar')
  })
})
