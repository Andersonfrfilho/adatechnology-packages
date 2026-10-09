import type { MessageDeliveryStatus, ParticipantMessage, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import type { ParticipantLocalPendingMessage, ParticipantPendingMessage } from './participantApi.types'

export type ParticipantPendingDisplayState = 'sending' | 'queued' | 'failed'
export type ParticipantOwnMessageStatus = 'sending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed'

export type ParticipantTimelineItem =
  | { readonly kind: 'server'; readonly message: ParticipantMessage }
  | {
      readonly kind: 'pending'
      readonly pending: ParticipantPendingMessage | ParticipantLocalPendingMessage
      readonly origin: 'host' | 'local'
      readonly displayState: ParticipantPendingDisplayState
    }

export type MergeParticipantMessagesParams = {
  readonly serverMessages: readonly ParticipantMessage[]
  readonly hostPending: readonly ParticipantPendingMessage[]
  readonly localPending: readonly ParticipantLocalPendingMessage[]
  readonly subject: ParticipantSubjectRef
}

export type ResolveOwnMessageStatusParams = {
  readonly displayState?: ParticipantPendingDisplayState
  readonly serverStatus?: MessageDeliveryStatus
  readonly confirmsRead: boolean
}

function isSameSubject(left: ParticipantSubjectRef, right: ParticipantSubjectRef): boolean {
  return left.subjectType === right.subjectType && left.subjectId === right.subjectId
}

function createdAtOf(item: ParticipantTimelineItem): number {
  return Date.parse(item.kind === 'server' ? item.message.createdAt : item.pending.createdAt)
}

export function mergeParticipantMessages(params: MergeParticipantMessagesParams): readonly ParticipantTimelineItem[] {
  const { serverMessages, hostPending, localPending, subject } = params
  const knownClientIds = new Set<string>()
  for (const message of serverMessages) {
    if (message.clientMessageId) knownClientIds.add(message.clientMessageId)
  }

  const items: ParticipantTimelineItem[] = serverMessages.map((message) => ({ kind: 'server', message }))

  for (const pending of hostPending) {
    if (!isSameSubject(pending.subject, subject) || knownClientIds.has(pending.clientMessageId)) continue
    knownClientIds.add(pending.clientMessageId)
    items.push({ kind: 'pending', pending, origin: 'host', displayState: pending.state })
  }

  for (const pending of localPending) {
    if (!isSameSubject(pending.subject, subject) || knownClientIds.has(pending.clientMessageId)) continue
    items.push({ kind: 'pending', pending, origin: 'local', displayState: pending.state })
  }

  return items.sort((left, right) => createdAtOf(left) - createdAtOf(right))
}

/** Direction is from the company perspective: the participant is the inbound side. */
export function isOwnMessage(message: ParticipantMessage): boolean {
  return message.direction === 'inbound'
}

export function resolveOwnMessageStatus(params: ResolveOwnMessageStatusParams): ParticipantOwnMessageStatus {
  const { displayState, serverStatus, confirmsRead } = params
  if (displayState) return displayState
  if (serverStatus === undefined) return 'sent'
  if (serverStatus === 'failed' || serverStatus === 'bounced') return 'failed'
  if (serverStatus === 'read') return confirmsRead ? 'read' : 'delivered'
  return serverStatus
}
