import { describe, expect, it } from 'bun:test'

import { buildMessage } from './participantFixtures.test-helper'
import { collectServerMessageIds, countNewIncomingMessages } from './participantNewMessages'
import type { ParticipantTimelineItem } from './participantMessages'

function server(id: string, direction: 'inbound' | 'outbound', createdAt = '2026-10-01T10:00:00.000Z'): ParticipantTimelineItem {
  return { kind: 'server', message: buildMessage({ id, direction, createdAt }) }
}

describe('countNewIncomingMessages', () => {
  it('counts only unseen messages from the other side (outbound)', () => {
    const items = [
      server('a', 'outbound', '2026-10-01T10:00:00.000Z'),
      server('b', 'outbound', '2026-10-01T10:01:00.000Z'),
      server('c', 'inbound', '2026-10-01T10:02:00.000Z'),
      server('d', 'outbound', '2026-10-01T10:03:00.000Z'),
    ]
    expect(countNewIncomingMessages(new Set(['a']), items)).toBe(2)
  })

  it('does not count outbound history loaded above the messages already seen', () => {
    const seen = [server('m30', 'outbound', '2026-10-01T10:30:00.000Z'), server('m31', 'inbound', '2026-10-01T10:31:00.000Z')]
    const older = [server('m1', 'outbound', '2026-10-01T10:01:00.000Z'), server('m2', 'outbound', '2026-10-01T10:02:00.000Z')]
    expect(countNewIncomingMessages(collectServerMessageIds(seen), [...older, ...seen])).toBe(0)
  })

  it('counts a reply that arrives after the messages already seen', () => {
    const seen = [server('m30', 'outbound', '2026-10-01T10:30:00.000Z'), server('m31', 'inbound', '2026-10-01T10:31:00.000Z')]
    const reply = server('m32', 'outbound', '2026-10-01T10:32:00.000Z')
    expect(countNewIncomingMessages(collectServerMessageIds(seen), [...seen, reply])).toBe(1)
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

describe('countNewIncomingMessages with the operator perspective', () => {
  const seen = [server('s', 'inbound', '2026-10-01T10:00:00.000Z')]
  const seenIds = collectServerMessageIds(seen)

  it('counts a new inbound message as news', () => {
    const items = [...seen, server('n', 'inbound', '2026-10-01T10:05:00.000Z')]
    expect(countNewIncomingMessages(seenIds, items, 'operator')).toBe(1)
  })

  it('does not count a new outbound message (written by the operator)', () => {
    const items = [...seen, server('n', 'outbound', '2026-10-01T10:05:00.000Z')]
    expect(countNewIncomingMessages(seenIds, items, 'operator')).toBe(0)
  })

  it('keeps the participant behavior when the perspective is omitted or participant', () => {
    const items = [...seen, server('n', 'outbound', '2026-10-01T10:05:00.000Z'), server('m', 'inbound', '2026-10-01T10:06:00.000Z')]
    expect(countNewIncomingMessages(seenIds, items)).toBe(1)
    expect(countNewIncomingMessages(seenIds, items, 'participant')).toBe(1)
  })
})
