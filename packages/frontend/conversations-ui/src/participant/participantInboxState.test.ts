import { describe, expect, it } from 'bun:test'

import type { ParticipantConversationSummary } from '@adatechnology/conversation-contracts'

import { INITIAL_PARTICIPANT_INBOX_STATE, participantInboxReducer } from './participantInboxState'

function conversation(subjectId: string, unreadCount = 0, subjectType = 'trip'): ParticipantConversationSummary {
  return { subjectType, subjectId, subjectLabel: subjectId, lastMessageAt: null, unreadCount, awaitingParticipant: false, status: 'open' }
}

describe('participantInboxReducer', () => {
  it('starts idle and goes to loading on started', () => {
    expect(INITIAL_PARTICIPANT_INBOX_STATE.status).toBe('idle')
    expect(participantInboxReducer(INITIAL_PARTICIPANT_INBOX_STATE, { type: 'started' }).status).toBe('loading')
  })

  it('keeps ready status while revalidating', () => {
    const ready = participantInboxReducer(INITIAL_PARTICIPANT_INBOX_STATE, { type: 'loaded', conversations: [conversation('a')] })
    expect(participantInboxReducer(ready, { type: 'started' }).status).toBe('ready')
  })

  it('loaded stores the list and the cursor', () => {
    const state = participantInboxReducer(INITIAL_PARTICIPANT_INBOX_STATE, { type: 'loaded', conversations: [conversation('a')], nextCursor: 'c1' })
    expect(state).toMatchObject({ status: 'ready', nextCursor: 'c1' })
    const replaced = participantInboxReducer(state, { type: 'loaded', conversations: [conversation('a')] })
    expect(replaced.conversations.map((item) => item.subjectId)).toEqual(['a'])
    expect(replaced.nextCursor).toBeUndefined()
  })

  it('loaded (revalidation) keeps the appended pages and lets the newest version of a subject win', () => {
    const first = participantInboxReducer(INITIAL_PARTICIPANT_INBOX_STATE, { type: 'loaded', conversations: [conversation('a'), conversation('b')], nextCursor: 'c1' })
    const paged = participantInboxReducer(first, { type: 'appended', conversations: [conversation('c'), conversation('d')], nextCursor: 'c2' })
    const revalidated = participantInboxReducer(paged, { type: 'loaded', conversations: [conversation('b', 7), conversation('a')], nextCursor: 'c1' })

    expect(revalidated.conversations.map((item) => item.subjectId)).toEqual(['b', 'a', 'c', 'd'])
    expect(revalidated.conversations[0]?.unreadCount).toBe(7)
    expect(revalidated.nextCursor).toBe('c2')
  })

  it('loaded takes the new cursor when no extra pages were appended', () => {
    const first = participantInboxReducer(INITIAL_PARTICIPANT_INBOX_STATE, { type: 'loaded', conversations: [conversation('a')], nextCursor: 'c1' })
    const revalidated = participantInboxReducer(first, { type: 'loaded', conversations: [conversation('a')], nextCursor: 'c9' })
    expect(revalidated.nextCursor).toBe('c9')
  })

  it('appended adds the next page without duplicating a subject', () => {
    const first = participantInboxReducer(INITIAL_PARTICIPANT_INBOX_STATE, { type: 'loaded', conversations: [conversation('a'), conversation('b')], nextCursor: 'c1' })
    const next = participantInboxReducer(first, { type: 'appended', conversations: [conversation('b', 3), conversation('c')] })
    expect(next.conversations.map((item) => item.subjectId)).toEqual(['a', 'b', 'c'])
    expect(next.conversations[1]?.unreadCount).toBe(3)
    expect(next.nextCursor).toBeUndefined()
  })

  it('markedRead zeroes only that subject', () => {
    const loaded = participantInboxReducer(INITIAL_PARTICIPANT_INBOX_STATE, {
      type: 'loaded',
      conversations: [conversation('a', 2), conversation('b', 4), conversation('a', 5, 'invoice')],
    })
    const next = participantInboxReducer(loaded, { type: 'markedRead', subject: { subjectType: 'trip', subjectId: 'a' } })
    expect(next.conversations.map((item) => item.unreadCount)).toEqual([0, 4, 5])
  })

  it('failed records the error and keeps the conversations', () => {
    const loaded = participantInboxReducer(INITIAL_PARTICIPANT_INBOX_STATE, { type: 'loaded', conversations: [conversation('a')] })
    const failed = participantInboxReducer(loaded, { type: 'failed', error: 'boom' })
    expect(failed).toMatchObject({ status: 'error', error: 'boom' })
    expect(failed.conversations).toHaveLength(1)
  })
})
