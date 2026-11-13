import { describe, expect, it } from 'bun:test'

import type { ParticipantMessage } from '@adatechnology/conversation-contracts'

import { INITIAL_PARTICIPANT_THREAD_STATE, participantThreadReducer, type ParticipantThreadState } from './participantThreadState'


function message(id: string, createdAt: string, overrides: Partial<ParticipantMessage> = {}): ParticipantMessage {
  return { id, direction: 'outbound', attachments: [], createdAt, ...overrides }
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

  it('sendConfirmed adds the server message once, ascending', () => {
    const base = participantThreadReducer(INITIAL_PARTICIPANT_THREAD_STATE, {
      type: 'loaded',
      messages: [message('m1', '2026-10-01T10:00:00.000Z')],
      hasMore: false,
    })
    const sent = message('m2', '2026-10-01T10:01:00.000Z', { clientMessageId: 'c1' })
    const confirmed = participantThreadReducer(participantThreadReducer(base, { type: 'sendConfirmed', message: sent }), { type: 'sendConfirmed', message: sent })

    expect(ids(confirmed)).toEqual(['m1', 'm2'])
  })

  it('reset returns to the initial state and failed records the error', () => {
    const loaded = participantThreadReducer(INITIAL_PARTICIPANT_THREAD_STATE, { type: 'loaded', messages: [message('m1', '2026-10-01T10:00:00.000Z')], hasMore: false })
    expect(participantThreadReducer(loaded, { type: 'reset' })).toEqual(INITIAL_PARTICIPANT_THREAD_STATE)
    expect(participantThreadReducer(loaded, { type: 'failed', error: 'boom' })).toMatchObject({ status: 'error', error: 'boom' })
  })
})
