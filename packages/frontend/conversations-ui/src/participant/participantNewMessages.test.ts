import { describe, expect, it } from 'bun:test'

import { buildMessage } from './participantFixtures.test-helper'
import { collectServerMessageIds, countNewIncomingMessages } from './participantNewMessages'
import type { ParticipantTimelineItem } from './participantMessages'

function server(id: string, direction: 'inbound' | 'outbound'): ParticipantTimelineItem {
  return { kind: 'server', message: buildMessage({ id, direction }) }
}

describe('countNewIncomingMessages', () => {
  it('counts only unseen messages from the other side (outbound)', () => {
    const items = [server('a', 'outbound'), server('b', 'outbound'), server('c', 'inbound'), server('d', 'outbound')]
    expect(countNewIncomingMessages(new Set(['a']), items)).toBe(2)
  })

  it('is zero when everything was seen', () => {
    const items = [server('a', 'outbound')]
    expect(countNewIncomingMessages(collectServerMessageIds(items), items)).toBe(0)
  })

  it('ignores the pending messages of the participant', () => {
    const pending: ParticipantTimelineItem = {
      kind: 'pending',
      origin: 'local',
      displayState: 'sending',
      pending: { clientMessageId: 'x', subject: { subjectType: 'invoice', subjectId: '1' }, createdAt: '2026-10-01T10:00:00.000Z', state: 'sending', text: 'hi' },
    }
    expect(countNewIncomingMessages(new Set(), [pending])).toBe(0)
  })
})

describe('collectServerMessageIds', () => {
  it('collects the ids of server items only', () => {
    expect([...collectServerMessageIds([server('a', 'inbound'), server('b', 'outbound')])]).toEqual(['a', 'b'])
  })
})
