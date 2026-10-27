import { useState, type MutableRefObject } from 'react'

import type { ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import {
  getDraft,
  setDraft,
  takeDraftForSend,
  type ParticipantDraft,
  type ParticipantDrafts,
  type ParticipantSendContent,
} from './participantDrafts'
import { appendEntryToDraft, type ParticipantSendEntry } from './participantSendController'

export type UseParticipantDraftResult = {
  readonly draft: ParticipantDraft
  readonly setText: (text: string) => void
  readonly setFiles: (files: readonly File[]) => void
  /** Clears the field synchronously and hands the content over; undefined when there is nothing to send. */
  readonly takeForSend: () => ParticipantSendContent | undefined
  readonly restoreFromEntry: (entry: ParticipantSendEntry) => void
}

/** The ref holds the truth (read at call time, so a double tap sees the cleared field); state only re-renders. */
export function useParticipantDraft(draftsRef: MutableRefObject<ParticipantDrafts>, subject: ParticipantSubjectRef): UseParticipantDraftResult {
  const [draft, setDraftState] = useState<ParticipantDraft>(() => getDraft(draftsRef.current, subject))

  function replaceDrafts(next: ParticipantDrafts): void {
    draftsRef.current = next
    setDraftState(getDraft(next, subject))
  }
  function update(change: Partial<ParticipantDraft>): void {
    replaceDrafts(setDraft(draftsRef.current, subject, { ...getDraft(draftsRef.current, subject), ...change }))
  }
  function takeForSend(): ParticipantSendContent | undefined {
    const taken = takeDraftForSend(draftsRef.current, subject)
    if (taken.content) replaceDrafts(taken.drafts)
    return taken.content
  }
  function restoreFromEntry(entry: ParticipantSendEntry): void {
    update(appendEntryToDraft(entry, getDraft(draftsRef.current, subject)))
  }

  return { draft, setText: (text) => update({ text }), setFiles: (files) => update({ files }), takeForSend, restoreFromEntry }
}
