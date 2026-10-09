import type { ParticipantMessage } from '@adatechnology/conversation-contracts'

import type { ParticipantLocalPendingMessage } from './participantApi.types'

export type ParticipantThreadState = {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  /** Ascending by createdAt. */
  readonly messages: readonly ParticipantMessage[]
  readonly hasMore: boolean
  readonly localPending: readonly ParticipantLocalPendingMessage[]
  readonly error?: string
}

export type ParticipantThreadAction =
  | { readonly type: 'reset' }
  | { readonly type: 'started' }
  | { readonly type: 'loaded'; readonly messages: readonly ParticipantMessage[]; readonly hasMore: boolean }
  | { readonly type: 'olderLoaded'; readonly messages: readonly ParticipantMessage[]; readonly hasMore: boolean }
  | { readonly type: 'failed'; readonly error: string }
  | { readonly type: 'pendingAdded'; readonly pending: ParticipantLocalPendingMessage }
  | { readonly type: 'pendingFailed'; readonly clientMessageId: string }
  | { readonly type: 'pendingRetrying'; readonly clientMessageId: string }
  | { readonly type: 'pendingRemoved'; readonly clientMessageId: string }
  | { readonly type: 'sendConfirmed'; readonly clientMessageId: string; readonly message: ParticipantMessage }

export const INITIAL_PARTICIPANT_THREAD_STATE: ParticipantThreadState = {
  status: 'idle',
  messages: [],
  hasMore: false,
  localPending: [],
}

function unionById(
  current: readonly ParticipantMessage[],
  incoming: readonly ParticipantMessage[],
): readonly ParticipantMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
}

function dropConfirmedPending(
  localPending: readonly ParticipantLocalPendingMessage[],
  messages: readonly ParticipantMessage[],
): readonly ParticipantLocalPendingMessage[] {
  const confirmedIds = new Set(messages.flatMap((message) => (message.clientMessageId ? [message.clientMessageId] : [])))
  return localPending.filter((pending) => !confirmedIds.has(pending.clientMessageId))
}

function mergeMessages(
  state: ParticipantThreadState,
  incoming: readonly ParticipantMessage[],
  hasMore: boolean,
): ParticipantThreadState {
  const messages = unionById(state.messages, incoming)
  const { error: _error, ...rest } = state
  return { ...rest, status: 'ready', messages, hasMore, localPending: dropConfirmedPending(state.localPending, messages) }
}

function updatePending(
  state: ParticipantThreadState,
  clientMessageId: string,
  pendingState: ParticipantLocalPendingMessage['state'],
): ParticipantThreadState {
  return {
    ...state,
    localPending: state.localPending.map((pending) =>
      pending.clientMessageId === clientMessageId ? { ...pending, state: pendingState } : pending,
    ),
  }
}

export function participantThreadReducer(state: ParticipantThreadState, action: ParticipantThreadAction): ParticipantThreadState {
  switch (action.type) {
    case 'reset':
      return INITIAL_PARTICIPANT_THREAD_STATE
    case 'started':
      return state.status === 'ready' ? state : { ...state, status: 'loading' }
    case 'loaded':
      return mergeMessages(state, action.messages, state.messages.length === 0 ? action.hasMore : state.hasMore)
    case 'olderLoaded':
      return mergeMessages(state, action.messages, action.hasMore)
    case 'failed':
      return { ...state, status: 'error', error: action.error }
    case 'pendingAdded':
      return { ...state, localPending: [...state.localPending.filter((item) => item.clientMessageId !== action.pending.clientMessageId), action.pending] }
    case 'pendingFailed':
      return updatePending(state, action.clientMessageId, 'failed')
    case 'pendingRetrying':
      return updatePending(state, action.clientMessageId, 'sending')
    case 'pendingRemoved':
      return { ...state, localPending: state.localPending.filter((pending) => pending.clientMessageId !== action.clientMessageId) }
    case 'sendConfirmed': {
      const confirmed = { ...state, localPending: state.localPending.filter((pending) => pending.clientMessageId !== action.clientMessageId) }
      return { ...confirmed, messages: unionById(confirmed.messages, [action.message]) }
    }
  }
}
