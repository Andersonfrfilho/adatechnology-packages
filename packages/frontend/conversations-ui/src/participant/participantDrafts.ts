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

export type ParticipantSendContent = {
  readonly text?: string
  readonly files?: readonly File[]
}

export type TakeDraftForSendResult = {
  readonly drafts: ParticipantDrafts
  /** Undefined when there was nothing to send, so a second tap on send does nothing. */
  readonly content?: ParticipantSendContent
}

/** The field is cleared the instant the user taps send; the bubble becomes the owner of the content. */
export function takeDraftForSend(drafts: ParticipantDrafts, subject: ParticipantSubjectRef): TakeDraftForSendResult {
  const draft = getDraft(drafts, subject)
  const text = draft.text.trim()
  if (!text && draft.files.length === 0) return { drafts }
  return {
    drafts: clearDraft(drafts, subject),
    content: { ...(text ? { text } : {}), ...(draft.files.length > 0 ? { files: draft.files } : {}) },
  }
}
