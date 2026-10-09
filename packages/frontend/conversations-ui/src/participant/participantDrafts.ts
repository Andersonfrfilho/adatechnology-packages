import type { ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

export type ParticipantDraft = {
  readonly text: string
  readonly files: readonly File[]
}

export type ParticipantDrafts = ReadonlyMap<string, ParticipantDraft>

export const EMPTY_PARTICIPANT_DRAFT: ParticipantDraft = { text: '', files: [] }

export function draftKey(subject: ParticipantSubjectRef): string {
  return `${subject.subjectType}:${subject.subjectId}`
}

export function getDraft(drafts: ParticipantDrafts, subject: ParticipantSubjectRef): ParticipantDraft {
  return drafts.get(draftKey(subject)) ?? EMPTY_PARTICIPANT_DRAFT
}

export function setDraft(drafts: ParticipantDrafts, subject: ParticipantSubjectRef, draft: ParticipantDraft): ParticipantDrafts {
  return new Map(drafts).set(draftKey(subject), draft)
}

export function clearDraft(drafts: ParticipantDrafts, subject: ParticipantSubjectRef): ParticipantDrafts {
  const next = new Map(drafts)
  next.delete(draftKey(subject))
  return next
}

/** Clears the subject only if the user did not type more while the send was in flight. */
export function clearDraftIfUnchanged(
  drafts: ParticipantDrafts,
  subject: ParticipantSubjectRef,
  sent: ParticipantDraft,
): ParticipantDrafts {
  return getDraft(drafts, subject) === sent ? clearDraft(drafts, subject) : drafts
}
