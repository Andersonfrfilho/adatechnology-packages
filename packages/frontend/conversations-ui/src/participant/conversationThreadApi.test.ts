import { describe, expect, it } from 'bun:test'

import { toParticipantApi, type ConversationThreadApi } from './conversationThreadApi'

const SUBJECT = { subjectType: 'invoice', subjectId: '1' }

function buildApi(overrides: Partial<ConversationThreadApi> = {}): ConversationThreadApi {
  return {
    fetchMessages: async () => [],
    sendMessage: async () => ({ outcome: 'queued' }),
    resolveAttachmentUrl: async () => 'x',
    ...overrides,
  } as ConversationThreadApi
}

describe('toParticipantApi markRead', () => {
  it('rejects when the host does not implement markRead, so nothing is reported as read', async () => {
    await expect(toParticipantApi(buildApi()).markRead(SUBJECT)).rejects.toThrow()
  })

  it('delegates to the host markRead keeping its this', async () => {
    const calls: unknown[] = []
    const host = buildApi({ markRead: async function (this: unknown, subject) { calls.push([this, subject]) } })
    await toParticipantApi(host).markRead(SUBJECT)
    expect(calls).toEqual([[host, SUBJECT]])
  })
})
