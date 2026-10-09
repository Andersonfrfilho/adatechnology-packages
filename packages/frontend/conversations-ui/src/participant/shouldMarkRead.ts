import type { ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

export type ShouldMarkParticipantReadParams = {
  readonly selected: ParticipantSubjectRef | undefined
  readonly subject: ParticipantSubjectRef
  readonly visibilityState: DocumentVisibilityState
  readonly unreadCount: number
}

export function shouldMarkParticipantRead(params: ShouldMarkParticipantReadParams): boolean {
  const { selected, subject, visibilityState, unreadCount } = params
  if (!selected) return false
  if (selected.subjectType !== subject.subjectType || selected.subjectId !== subject.subjectId) return false
  if (visibilityState !== 'visible') return false
  return unreadCount > 0
}
