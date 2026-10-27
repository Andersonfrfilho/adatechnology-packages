import type { MessageDirection, ParticipantMessage } from '@adatechnology/conversation-contracts'

/** Who is looking at the conversation. `participant` is the outside party; `operator` is the company. */
export type ParticipantPerspective = 'participant' | 'operator'

export const DEFAULT_PARTICIPANT_PERSPECTIVE: ParticipantPerspective = 'participant'

/** `direction` is from the company side: the participant writes `inbound`, the operator writes `outbound`. */
const OWN_DIRECTION: Record<ParticipantPerspective, MessageDirection> = {
  participant: 'inbound',
  operator: 'outbound',
}

export function isMessageMine(
  message: Pick<ParticipantMessage, 'direction'>,
  perspective: ParticipantPerspective = DEFAULT_PARTICIPANT_PERSPECTIVE,
): boolean {
  return message.direction === OWN_DIRECTION[perspective]
}

type ReadState = Pick<ParticipantMessage, 'direction' | 'status' | 'readAt'>

function isUnreadByViewer(message: ReadState, perspective: ParticipantPerspective): boolean {
  if (isMessageMine(message, perspective)) return false
  return !message.readAt && message.status !== 'read'
}

export function countOtherSideMessages(
  messages: readonly Pick<ParticipantMessage, 'direction'>[],
  perspective: ParticipantPerspective,
): number {
  return messages.filter((message) => !isMessageMine(message, perspective)).length
}

export function countUnreadByViewer(messages: readonly ReadState[], perspective: ParticipantPerspective): number {
  return messages.filter((message) => isUnreadByViewer(message, perspective)).length
}

export type ResolveViewerUnreadParams = {
  readonly messages: readonly ReadState[]
  readonly perspective: ParticipantPerspective
  /** How many other-side messages the viewer already acknowledged through markRead. */
  readonly acknowledgedCount: number
}

/** Unread other-side messages, or zero while nothing arrived since the last acknowledgement. */
export function resolveViewerUnread({ messages, perspective, acknowledgedCount }: ResolveViewerUnreadParams): number {
  if (countOtherSideMessages(messages, perspective) <= acknowledgedCount) return 0
  return countUnreadByViewer(messages, perspective)
}
