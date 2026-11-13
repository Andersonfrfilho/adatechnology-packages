import { describe, expect, it } from 'bun:test'

import type { ParticipantMessage } from '@adatechnology/conversation-contracts'

import type { ParticipantLocalPendingMessage, ParticipantPendingMessage } from './participantApi.types'
import { isOwnMessage, mergeParticipantMessages, resolveOwnMessageStatus } from './participantMessages'

const SUBJECT = { subjectType: 'trip', subjectId: 'a' }
const OTHER_SUBJECT = { subjectType: 'trip', subjectId: 'b' }

function server(id: string, createdAt: string, overrides: Partial<ParticipantMessage> = {}): ParticipantMessage {
  return { id, direction: 'inbound', attachments: [], createdAt, ...overrides }
}
function host(clientMessageId: string, createdAt: string, overrides: Partial<ParticipantPendingMessage> = {}): ParticipantPendingMessage {
  return { clientMessageId, subject: SUBJECT, text: 'x', createdAt, state: 'queued', ...overrides }
}
function local(clientMessageId: string, createdAt: string, overrides: Partial<ParticipantLocalPendingMessage> = {}): ParticipantLocalPendingMessage {
  return { clientMessageId, subject: SUBJECT, text: 'x', createdAt, state: 'sending', ...overrides }
}

describe('mergeParticipantMessages', () => {
  it('orders everything by createdAt ascending', () => {
    const items = mergeParticipantMessages({
      serverMessages: [server('s2', '2026-10-01T10:02:00.000Z'), server('s1', '2026-10-01T10:00:00.000Z')],
      hostPending: [host('h1', '2026-10-01T10:03:00.000Z')],
      localPending: [local('l1', '2026-10-01T10:01:00.000Z')],
      subject: SUBJECT,
    })
    expect(items.map((item) => (item.kind === 'server' ? item.message.id : item.pending.clientMessageId))).toEqual(['s1', 'l1', 's2', 'h1'])
  })

  it('hides a host pending when a server message has the same clientMessageId', () => {
    const items = mergeParticipantMessages({
      serverMessages: [server('s1', '2026-10-01T10:00:00.000Z', { clientMessageId: 'c1' })],
      hostPending: [host('c1', '2026-10-01T09:59:00.000Z')],
      localPending: [],
      subject: SUBJECT,
    })
    expect(items).toHaveLength(1)
    expect(items[0]?.kind).toBe('server')
  })

  it('ignores host pending of another subject', () => {
    const items = mergeParticipantMessages({
      serverMessages: [],
      hostPending: [host('c1', '2026-10-01T09:59:00.000Z', { subject: OTHER_SUBJECT })],
      localPending: [],
      subject: SUBJECT,
    })
    expect(items).toHaveLength(0)
  })

  it('maps host pending states and tags the origin', () => {
    const items = mergeParticipantMessages({
      serverMessages: [],
      hostPending: [host('q', '2026-10-01T10:00:00.000Z'), host('f', '2026-10-01T10:01:00.000Z', { state: 'failed' })],
      localPending: [],
      subject: SUBJECT,
    })
    expect(items.map((item) => (item.kind === 'pending' ? [item.origin, item.displayState] : []))).toEqual([
      ['host', 'queued'],
      ['host', 'failed'],
    ])
  })

  it('shows local pending as sending or failed when no other source has it', () => {
    const items = mergeParticipantMessages({
      serverMessages: [],
      hostPending: [],
      localPending: [local('a', '2026-10-01T10:00:00.000Z'), local('b', '2026-10-01T10:01:00.000Z', { state: 'failed' })],
      subject: SUBJECT,
    })
    expect(items.map((item) => (item.kind === 'pending' ? [item.origin, item.displayState] : []))).toEqual([
      ['local', 'sending'],
      ['local', 'failed'],
    ])
  })

  it('hides a local pending already present on the server or at the host', () => {
    const items = mergeParticipantMessages({
      serverMessages: [server('s1', '2026-10-01T10:00:00.000Z', { clientMessageId: 'a' })],
      hostPending: [host('b', '2026-10-01T10:01:00.000Z')],
      localPending: [local('a', '2026-10-01T09:59:00.000Z'), local('b', '2026-10-01T09:59:30.000Z')],
      subject: SUBJECT,
    })
    expect(items.map((item) => item.kind)).toEqual(['server', 'pending'])
    expect(items[1]).toMatchObject({ kind: 'pending', origin: 'host' })
  })

  it('keeps a failed local pending with its original clientMessageId for resend', () => {
    const items = mergeParticipantMessages({
      serverMessages: [],
      hostPending: [],
      localPending: [local('keep-me', '2026-10-01T10:00:00.000Z', { state: 'failed' })],
      subject: SUBJECT,
    })
    expect(items[0]).toMatchObject({ kind: 'pending', pending: { clientMessageId: 'keep-me' } })
  })
})

describe('isOwnMessage', () => {
  it('treats inbound (company perspective) as the participant own message', () => {
    expect(isOwnMessage(server('s', '2026-10-01T10:00:00.000Z', { direction: 'inbound' }))).toBe(true)
    expect(isOwnMessage(server('s', '2026-10-01T10:00:00.000Z', { direction: 'outbound' }))).toBe(false)
  })
})

describe('resolveOwnMessageStatus', () => {
  it('uses the local display state for pending messages', () => {
    expect(resolveOwnMessageStatus({ displayState: 'sending', confirmsRead: true })).toBe('sending')
    expect(resolveOwnMessageStatus({ displayState: 'queued', confirmsRead: true })).toBe('queued')
    expect(resolveOwnMessageStatus({ displayState: 'failed', confirmsRead: true })).toBe('failed')
  })
  it('defaults to sent without server status', () => {
    expect(resolveOwnMessageStatus({ confirmsRead: true })).toBe('sent')
  })
  it('maps server statuses', () => {
    expect(resolveOwnMessageStatus({ serverStatus: 'queued', confirmsRead: true })).toBe('queued')
    expect(resolveOwnMessageStatus({ serverStatus: 'sent', confirmsRead: true })).toBe('sent')
    expect(resolveOwnMessageStatus({ serverStatus: 'delivered', confirmsRead: true })).toBe('delivered')
    expect(resolveOwnMessageStatus({ serverStatus: 'failed', confirmsRead: true })).toBe('failed')
    expect(resolveOwnMessageStatus({ serverStatus: 'bounced', confirmsRead: true })).toBe('failed')
  })
  it('reports read only when the channel confirms it', () => {
    expect(resolveOwnMessageStatus({ serverStatus: 'read', confirmsRead: true })).toBe('read')
    expect(resolveOwnMessageStatus({ serverStatus: 'read', confirmsRead: false })).toBe('delivered')
  })
})
