import type {
  ParticipantConversationStatus,
  ParticipantConversationSummary,
  ParticipantSubjectRef,
} from '@adatechnology/conversation-contracts'

export type BuildThreadSummaryParams = {
  readonly subject: ParticipantSubjectRef
  readonly title: string
  readonly protocol?: string
  readonly channels?: ParticipantConversationSummary['channels']
  readonly status?: ParticipantConversationStatus
}

/** The header reads a summary; a single conversation has no list to take it from, so the host's props build it. */
export function buildThreadSummary({
  subject,
  title,
  protocol,
  channels,
  status,
}: BuildThreadSummaryParams): ParticipantConversationSummary {
  return {
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    subjectLabel: title,
    lastMessageAt: null,
    unreadCount: 0,
    awaitingParticipant: false,
    status: status ?? 'open',
    ...(protocol ? { protocol } : {}),
    ...(channels ? { channels } : {}),
  }
}
