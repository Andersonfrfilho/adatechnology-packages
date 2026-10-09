import { describe, expect, it } from 'bun:test'

import { buildMessage } from './participantFixtures.test-helper'
import { isOwnMessage } from './participantMessages'
import {
  countOtherSideMessages,
  countUnreadByViewer,
  isMessageMine,
  resolveViewerUnread,
} from './participantPerspective'

const INBOUND = buildMessage({ id: 'i', direction: 'inbound' })
const OUTBOUND = buildMessage({ id: 'o', direction: 'outbound' })

describe('isMessageMine', () => {
  it('treats inbound as mine for the participant, and by default', () => {
    expect(isMessageMine(INBOUND, 'participant')).toBe(true)
    expect(isMessageMine(OUTBOUND, 'participant')).toBe(false)
    expect(isMessageMine(INBOUND)).toBe(true)
    expect(isMessageMine(OUTBOUND)).toBe(false)
  })

  it('inverts for the operator: outbound is mine', () => {
    expect(isMessageMine(OUTBOUND, 'operator')).toBe(true)
    expect(isMessageMine(INBOUND, 'operator')).toBe(false)
  })

  it('keeps isOwnMessage identical without a perspective', () => {
    expect(isOwnMessage(INBOUND)).toBe(true)
    expect(isOwnMessage(OUTBOUND)).toBe(false)
    expect(isOwnMessage(OUTBOUND, 'operator')).toBe(true)
  })
})

describe('unread by the viewer', () => {
  const MESSAGES = [
    buildMessage({ id: 'a', direction: 'inbound' }),
    buildMessage({ id: 'b', direction: 'inbound', status: 'read' }),
    buildMessage({ id: 'c', direction: 'inbound', readAt: '2026-10-01T11:00:00.000Z' }),
    buildMessage({ id: 'd', direction: 'outbound' }),
    buildMessage({ id: 'e', direction: 'outbound' }),
  ]

  it('counts only the other side, never the viewer own messages', () => {
    expect(countUnreadByViewer(MESSAGES, 'operator')).toBe(1)
    expect(countUnreadByViewer(MESSAGES, 'participant')).toBe(2)
    expect(countOtherSideMessages(MESSAGES, 'operator')).toBe(3)
    expect(countOtherSideMessages(MESSAGES, 'participant')).toBe(2)
  })

  it('reads nothing as unread when the operator has only outbound messages', () => {
    expect(countUnreadByViewer([OUTBOUND, OUTBOUND], 'operator')).toBe(0)
  })

  it('resolves to zero until something new arrives after the acknowledgement', () => {
    const base = { messages: MESSAGES, perspective: 'operator' } as const
    expect(resolveViewerUnread({ ...base, acknowledgedCount: 0 })).toBe(1)
    expect(resolveViewerUnread({ ...base, acknowledgedCount: 3 })).toBe(0)
    expect(
      resolveViewerUnread({
        ...base,
        messages: [...MESSAGES, buildMessage({ id: 'f', direction: 'inbound' })],
        acknowledgedCount: 3,
      }),
    ).toBe(2)
  })
})
