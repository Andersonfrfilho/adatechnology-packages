import { describe, expect, it } from 'bun:test'

import type { ParticipantTimelineItem } from './participantMessages'
import { resolveParticipantBubbleActions } from './participantBubbleActions'

const SUBJECT = { subjectType: 'trip', subjectId: 'a' }
const noop = (): void => undefined

function pendingItem(origin: 'host' | 'local', displayState: 'sending' | 'queued' | 'failed'): ParticipantTimelineItem {
  return {
    kind: 'pending',
    origin,
    displayState,
    pending: { clientMessageId: 'c1', subject: SUBJECT, createdAt: '2026-10-01T10:00:00.000Z', state: displayState === 'sending' ? 'failed' : displayState },
  }
}

const HANDLERS = { retryLocal: noop, discardLocal: noop, editLocal: noop }

describe('resolveParticipantBubbleActions', () => {
  it('a failed local pending offers retry, discard and edit', () => {
    const actions = resolveParticipantBubbleActions(pendingItem('local', 'failed'), HANDLERS)
    expect(Object.keys(actions).sort()).toEqual(['onDiscard', 'onEdit', 'onRetry'])
  })

  it('a pending that is not failed offers nothing', () => {
    expect(resolveParticipantBubbleActions(pendingItem('local', 'sending'), HANDLERS)).toEqual({})
    expect(resolveParticipantBubbleActions(pendingItem('local', 'queued'), HANDLERS)).toEqual({})
  })

  it('a failed host pending offers retry only when the host gave onRetryPending, never discard or edit', () => {
    expect(resolveParticipantBubbleActions(pendingItem('host', 'failed'), HANDLERS)).toEqual({})
    const withHost = resolveParticipantBubbleActions(pendingItem('host', 'failed'), { ...HANDLERS, retryHost: noop })
    expect(Object.keys(withHost)).toEqual(['onRetry'])
  })

  it('a failed server message never offers any action', () => {
    const item: ParticipantTimelineItem = {
      kind: 'server',
      message: { id: 'm1', direction: 'inbound', attachments: [], createdAt: '2026-10-01T10:00:00.000Z', status: 'failed', clientMessageId: 'c1' },
    }
    expect(resolveParticipantBubbleActions(item, { ...HANDLERS, retryHost: noop })).toEqual({})
  })
})
