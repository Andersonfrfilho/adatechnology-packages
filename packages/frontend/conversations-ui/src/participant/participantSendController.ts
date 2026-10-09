import type { ParticipantMessage, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import type { ParticipantLocalPendingMessage, ParticipantPendingMessage } from './participantApi.types'
import type { ParticipantDraft, ParticipantSendContent } from './participantDrafts'

export type ParticipantSendEntryState = 'sending' | 'queued' | 'failed'

/** The bubble owns the content of a send: text and files live here until the server (or the host queue) reflects the id. */
export type ParticipantSendEntry = {
  readonly clientMessageId: string
  readonly subject: ParticipantSubjectRef
  readonly text?: string
  readonly files: readonly File[]
  readonly createdAt: string
  readonly state: ParticipantSendEntryState
}

export type ParticipantSendAction =
  | { readonly type: 'started'; readonly entry: ParticipantSendEntry }
  | { readonly type: 'confirmed'; readonly clientMessageId: string }
  | { readonly type: 'queued'; readonly clientMessageId: string }
  | { readonly type: 'failed'; readonly clientMessageId: string }
  | { readonly type: 'retried'; readonly clientMessageId: string }
  | { readonly type: 'discarded'; readonly clientMessageId: string }
  | { readonly type: 'reflected'; readonly knownClientMessageIds: ReadonlySet<string> }

export type CreateParticipantSendEntryParams = {
  readonly clientMessageId: string
  readonly subject: ParticipantSubjectRef
  readonly content: ParticipantSendContent
  readonly createdAt: string
  readonly files?: readonly File[]
  readonly state?: ParticipantSendEntryState
}

export type CollectKnownClientMessageIdsParams = {
  readonly messages: readonly ParticipantMessage[]
  readonly hostPending: readonly ParticipantPendingMessage[]
}

export function createParticipantSendEntry(params: CreateParticipantSendEntryParams): ParticipantSendEntry {
  const { clientMessageId, subject, content, createdAt, state = 'sending' } = params
  return {
    clientMessageId,
    subject,
    ...(content.text ? { text: content.text } : {}),
    files: params.files ?? content.files ?? [],
    createdAt,
    state,
  }
}

function setState(
  entries: readonly ParticipantSendEntry[],
  clientMessageId: string,
  allowedFrom: readonly ParticipantSendEntryState[],
  next: ParticipantSendEntryState,
): readonly ParticipantSendEntry[] {
  const target = entries.find((item) => item.clientMessageId === clientMessageId)
  if (!target || !allowedFrom.includes(target.state) || target.state === next) return entries
  return entries.map((item) => (item === target ? { ...item, state: next } : item))
}

function remove(entries: readonly ParticipantSendEntry[], shouldRemove: (item: ParticipantSendEntry) => boolean): readonly ParticipantSendEntry[] {
  const kept = entries.filter((item) => !shouldRemove(item))
  return kept.length === entries.length ? entries : kept
}

export function participantSendReducer(
  entries: readonly ParticipantSendEntry[],
  action: ParticipantSendAction,
): readonly ParticipantSendEntry[] {
  switch (action.type) {
    case 'started':
      return [...entries.filter((item) => item.clientMessageId !== action.entry.clientMessageId), action.entry]
    case 'confirmed':
    case 'discarded':
      return remove(entries, (item) => item.clientMessageId === action.clientMessageId)
    case 'queued':
      return setState(entries, action.clientMessageId, ['sending'], 'queued')
    case 'failed':
      return setState(entries, action.clientMessageId, ['sending', 'queued'], 'failed')
    case 'retried':
      return setState(entries, action.clientMessageId, ['failed'], 'sending')
    case 'reflected':
      return remove(entries, (item) => action.knownClientMessageIds.has(item.clientMessageId))
  }
}

export function findFailedEntry(entries: readonly ParticipantSendEntry[], clientMessageId: string): ParticipantSendEntry | undefined {
  return entries.find((item) => item.clientMessageId === clientMessageId && item.state === 'failed')
}

export function collectKnownClientMessageIds(params: CollectKnownClientMessageIdsParams): ReadonlySet<string> {
  const known = new Set<string>()
  for (const message of params.messages) {
    if (message.clientMessageId) known.add(message.clientMessageId)
  }
  for (const pending of params.hostPending) known.add(pending.clientMessageId)
  return known
}

export function toLocalPending(entries: readonly ParticipantSendEntry[]): readonly ParticipantLocalPendingMessage[] {
  return entries.map((item) => {
    const attachments = item.files.map((file) => ({ filename: file.name, mimeType: file.type, sizeBytes: file.size }))
    return {
      clientMessageId: item.clientMessageId,
      subject: item.subject,
      createdAt: item.createdAt,
      state: item.state,
      ...(item.text ? { text: item.text } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    }
  })
}

/** Edit hands the content back to the field; whatever the user typed meanwhile stays after it. */
export function appendEntryToDraft(entry: ParticipantSendEntry, current: ParticipantDraft): ParticipantDraft {
  const text = [entry.text, current.text].filter((part): part is string => Boolean(part)).join('\n')
  return { text, files: [...entry.files, ...current.files] }
}
