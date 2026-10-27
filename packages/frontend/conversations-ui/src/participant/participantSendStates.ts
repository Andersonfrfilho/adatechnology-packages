import type { ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { draftKey } from './participantDrafts'
import { participantSendReducer, type ParticipantSendAction, type ParticipantSendEntry } from './participantSendController'

/** Entries of every subject, kept above the conversation so leaving and coming back does not lose a failed message. */
export type ParticipantSendStates = ReadonlyMap<string, readonly ParticipantSendEntry[]>

export type ParticipantSendStatesAction = {
  readonly subject: ParticipantSubjectRef
  readonly action: ParticipantSendAction
}

const NO_ENTRIES: readonly ParticipantSendEntry[] = []

export function selectSendEntries(states: ParticipantSendStates, subject: ParticipantSubjectRef): readonly ParticipantSendEntry[] {
  return states.get(draftKey(subject)) ?? NO_ENTRIES
}

export function participantSendStatesReducer(
  states: ParticipantSendStates,
  { subject, action }: ParticipantSendStatesAction,
): ParticipantSendStates {
  const current = selectSendEntries(states, subject)
  const next = participantSendReducer(current, action)
  if (next === current) return states
  const copy = new Map(states)
  if (next.length === 0) copy.delete(draftKey(subject))
  else copy.set(draftKey(subject), next)
  return copy
}
