import type { ParticipantConversationsApi } from './participantApi.types'

/** What one conversation needs from the host: no list, no open-by-subject. `markRead` and `subscribe` are optional. */
export type ConversationThreadApi = Pick<
  ParticipantConversationsApi,
  'fetchMessages' | 'sendMessage' | 'resolveAttachmentUrl'
> &
  Partial<Pick<ParticipantConversationsApi, 'markRead' | 'subscribe'>>

/** Methods are delegated, never detached, so adapters written as classes keep their `this`. */
export function toParticipantApi(api: ConversationThreadApi): ParticipantConversationsApi {
  const { subscribe } = api
  return {
    listConversations: async () => ({ data: [] }),
    fetchMessages: (subject, params) => api.fetchMessages(subject, params),
    sendMessage: (input) => api.sendMessage(input),
    markRead: async (subject) => {
      if (!api.markRead) throw new Error('The host api has no markRead')
      await api.markRead(subject)
    },
    resolveAttachmentUrl: (attachment, disposition) => api.resolveAttachmentUrl(attachment, disposition),
    ...(subscribe ? { subscribe: (listener) => api.subscribe?.(listener) ?? (() => undefined) } : {}),
  }
}
