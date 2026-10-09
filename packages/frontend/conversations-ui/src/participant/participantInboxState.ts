import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

export type ParticipantInboxState = {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly conversations: readonly ParticipantConversationSummary[]
  readonly nextCursor?: string
  readonly error?: string
}

export type ParticipantInboxAction =
  | { readonly type: 'started' }
  | { readonly type: 'loaded'; readonly conversations: readonly ParticipantConversationSummary[]; readonly nextCursor?: string }
  | { readonly type: 'appended'; readonly conversations: readonly ParticipantConversationSummary[]; readonly nextCursor?: string }
  | { readonly type: 'markedRead'; readonly subject: ParticipantSubjectRef }
  | { readonly type: 'failed'; readonly error: string }

export const INITIAL_PARTICIPANT_INBOX_STATE: ParticipantInboxState = { status: 'idle', conversations: [] }

function subjectKey(subject: ParticipantSubjectRef): string {
  return `${subject.subjectType}:${subject.subjectId}`
}

function withCursor(
  state: ParticipantInboxState,
  conversations: readonly ParticipantConversationSummary[],
  nextCursor: string | undefined,
): ParticipantInboxState {
  const { error: _error, nextCursor: _nextCursor, ...rest } = state
  return { ...rest, status: 'ready', conversations, ...(nextCursor === undefined ? {} : { nextCursor }) }
}

/** Revalidation brings the first page again: it must not drop the pages appended after it. */
function mergeFirstPage(
  state: ParticipantInboxState,
  incoming: readonly ParticipantConversationSummary[],
  nextCursor: string | undefined,
): ParticipantInboxState {
  const incomingKeys = new Set(incoming.map(subjectKey))
  const retained = state.conversations.filter((conversation) => !incomingKeys.has(subjectKey(conversation)))
  const cursor = retained.length > 0 ? state.nextCursor : nextCursor
  return withCursor(state, [...incoming, ...retained], cursor)
}

function appendUnique(
  current: readonly ParticipantConversationSummary[],
  incoming: readonly ParticipantConversationSummary[],
): readonly ParticipantConversationSummary[] {
  const incomingByKey = new Map(incoming.map((conversation) => [subjectKey(conversation), conversation]))
  const updated = current.map((conversation) => incomingByKey.get(subjectKey(conversation)) ?? conversation)
  const knownKeys = new Set(current.map(subjectKey))
  return [...updated, ...incoming.filter((conversation) => !knownKeys.has(subjectKey(conversation)))]
}

export function participantInboxReducer(state: ParticipantInboxState, action: ParticipantInboxAction): ParticipantInboxState {
  switch (action.type) {
    case 'started':
      return state.status === 'ready' ? state : { ...state, status: 'loading' }
    case 'loaded':
      return mergeFirstPage(state, action.conversations, action.nextCursor)
    case 'appended':
      return withCursor(state, appendUnique(state.conversations, action.conversations), action.nextCursor)
    case 'markedRead': {
      const target = subjectKey(action.subject)
      return {
        ...state,
        conversations: state.conversations.map((conversation) =>
          subjectKey(conversation) === target ? { ...conversation, unreadCount: 0 } : conversation,
        ),
      }
    }
    case 'failed':
      return { ...state, status: 'error', error: action.error }
  }
}
