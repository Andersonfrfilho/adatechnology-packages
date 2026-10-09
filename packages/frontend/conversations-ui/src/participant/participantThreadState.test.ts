import { describe, expect, it } from 'bun:test'

import type { ParticipantMessage } from '@adatechnology/conversation-contracts'

import type { ParticipantLocalPendingMessage } from './participantApi.types'
import { INITIAL_PARTICIPANT_THREAD_STATE, participantThreadReducer, type ParticipantThreadState } from './participantThreadState'

const SUBJECT = { subjectType: 'trip', subjectId: 'a' }

function message(id: string, createdAt: string, overrides: Partial<ParticipantMessage> = {}): ParticipantMessage {
  return { id, direction: 'outbound', attachments: [], createdAt, ...overrides }
}
function pending(clientMessageId: string): ParticipantLocalPendingMessage {
  return { clientMessageId, subject: SUBJECT, text: 'hi', createdAt: '2026-10-01T10:00:00.000Z', state: 'sending' }
}
function ids(state: ParticipantThreadState): string[] {
  return state.messages.map((item) => item.id)
}

describe('participantThreadReducer', () => {
  it('loaded stores messages ascending and the hasMore flag', () => {
    const state = participantThreadReducer(INITIAL_PARTICIPANT_THREAD_STATE, {
      type: 'loaded',
      messages: [message('m2', '2026-10-01T10:02:00.000Z'), message('m1', '2026-10-01T10:01:00.000Z')],
      hasMore: true,
    })
    expect(ids(state)).toEqual(['m1', 'm2'])
    expect(state).toMatchObject({ status: 'ready', hasMore: true })
  })

  it('olderLoaded prepends without duplicating by id', () => {
    const first = participantThreadReducer(INITIAL_PARTICIPANT_THREAD_STATE, {
      type: 'loaded',
      messages: [message('m3', '2026-10-01T10:03:00.000Z'), message('m4', '2026-10-01T10:04:00.000Z')],
      hasMore: true,
    })
    const next = participantThreadReducer(first, {
      type: 'olderLoaded',
      messages: [message('m1', '2026-10-01T10:01:00.000Z'), message('m2', '2026-10-01T10:02:00.000Z'), message('m3', '2026-10-01T10:03:00.000Z')],
      hasMore: false,
    })
    expect(ids(next)).toEqual(['m1', 'm2', 'm3', 'm4'])
    expect(next.hasMore).toBe(false)
  })

  it('a revalidation keeps older pages already fetched and the existing hasMore', () => {
    const first = participantThreadReducer(INITIAL_PARTICIPANT_THREAD_STATE, {
      type: 'loaded',
      messages: [message('m2', '2026-10-01T10:02:00.000Z')],
      hasMore: true,
    })
    const older = participantThreadReducer(first, { type: 'olderLoaded', messages: [message('m1', '2026-10-01T10:01:00.000Z')], hasMore: false })
    const revalidated = participantThreadReducer(older, {
      type: 'loaded',
      messages: [message('m2', '2026-10-01T10:02:00.000Z', { status: 'read' }), message('m3', '2026-10-01T10:03:00.000Z')],
      hasMore: true,
    })
    expect(ids(revalidated)).toEqual(['m1', 'm2', 'm3'])
    expect(revalidated.messages[1]?.status).toBe('read')
    expect(revalidated.hasMore).toBe(false)
  })

  it('pendingAdded registers a sending local pending', () => {
    const state = participantThreadReducer(INITIAL_PARTICIPANT_THREAD_STATE, { type: 'pendingAdded', pending: pending('c1') })
    expect(state.localPending).toEqual([pending('c1')])
  })

  it('pendingFailed marks failed and pendingRetrying returns to sending, keeping the clientMessageId', () => {
    const added = participantThreadReducer(INITIAL_PARTICIPANT_THREAD_STATE, { type: 'pendingAdded', pending: pending('c1') })
    const failed = participantThreadReducer(added, { type: 'pendingFailed', clientMessageId: 'c1' })
    expect(failed.localPending[0]).toMatchObject({ clientMessageId: 'c1', state: 'failed' })
    const retrying = participantThreadReducer(failed, { type: 'pendingRetrying', clientMessageId: 'c1' })
    expect(retrying.localPending[0]).toMatchObject({ clientMessageId: 'c1', state: 'sending' })
  })

  it('sendConfirmed removes the pending and adds the server message', () => {
    const added = participantThreadReducer(INITIAL_PARTICIPANT_THREAD_STATE, { type: 'pendingAdded', pending: pending('c1') })
    const confirmed = participantThreadReducer(added, {
      type: 'sendConfirmed',
      clientMessageId: 'c1',
      message: message('m1', '2026-10-01T10:00:00.000Z', { clientMessageId: 'c1' }),
    })
    expect(confirmed.localPending).toHaveLength(0)
    expect(ids(confirmed)).toEqual(['m1'])
  })

  it('pendingRemoved drops the pending (host queued it)', () => {
    const added = participantThreadReducer(INITIAL_PARTICIPANT_THREAD_STATE, { type: 'pendingAdded', pending: pending('c1') })
    expect(participantThreadReducer(added, { type: 'pendingRemoved', clientMessageId: 'c1' }).localPending).toHaveLength(0)
  })

  it('a server message with the same clientMessageId removes the local pending on load', () => {
    const added = participantThreadReducer(INITIAL_PARTICIPANT_THREAD_STATE, { type: 'pendingAdded', pending: pending('c1') })
    const loaded = participantThreadReducer(added, {
      type: 'loaded',
      messages: [message('m1', '2026-10-01T10:00:00.000Z', { clientMessageId: 'c1' })],
      hasMore: false,
    })
    expect(loaded.localPending).toHaveLength(0)
  })

  it('reset returns to the initial state and failed records the error', () => {
    const added = participantThreadReducer(INITIAL_PARTICIPANT_THREAD_STATE, { type: 'pendingAdded', pending: pending('c1') })
    expect(participantThreadReducer(added, { type: 'reset' })).toEqual(INITIAL_PARTICIPANT_THREAD_STATE)
    expect(participantThreadReducer(added, { type: 'failed', error: 'boom' })).toMatchObject({ status: 'error', error: 'boom' })
  })
})
