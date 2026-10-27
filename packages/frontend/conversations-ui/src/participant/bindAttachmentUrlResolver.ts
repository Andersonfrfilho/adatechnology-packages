import type { ResolveParticipantAttachmentUrl } from './ParticipantAttachmentItem'
import type { ParticipantConversationsApi } from './participantApi.types'

/** A detached method reference loses `this`; adapters written as classes break without the wrapper. */
export function bindAttachmentUrlResolver(api: ParticipantConversationsApi): ResolveParticipantAttachmentUrl {
  return (attachment, disposition) => api.resolveAttachmentUrl(attachment, disposition)
}
