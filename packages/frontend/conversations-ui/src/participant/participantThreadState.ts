import type { ParticipantMessage } from '@adatechnology/conversation-contracts'

export type ParticipantThreadState = {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  /** Ascending by createdAt. */
  readonly messages: readonly ParticipantMessage[]
  readonly hasMore: boolean
  readonly error?: string
}

export type ParticipantThreadAction =
  | { readonly type: 'reset' }
  | { readonly type: 'started' }
  | { readonly type: 'loaded'; readonly messages: readonly ParticipantMessage[]; readonly hasMore: boolean }
  | { readonly type: 'olderLoaded'; readonly messages: readonly ParticipantMessage[]; readonly hasMore: boolean }
  | { readonly type: 'failed'; readonly error: string }
  | { readonly type: 'sendConfirmed'; readonly message: ParticipantMessage }

export const INITIAL_PARTICIPANT_THREAD_STATE: ParticipantThreadState = {
  status: 'idle',
  messages: [],
  hasMore: false,
}

function unionById(
  current: readonly ParticipantMessage[],
  incoming: readonly ParticipantMessage[],
): readonly ParticipantMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
}

function mergeMessages(
  state: ParticipantThreadState,
  incoming: readonly ParticipantMessage[],
  hasMore: boolean,
): ParticipantThreadState {
  const messages = unionById(state.messages, incoming)
  const { error: _error, ...rest } = state
  return { ...rest, status: 'ready', messages, hasMore }
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
    case 'sendConfirmed':
      return { ...state, messages: unionById(state.messages, [action.message]) }
  }
}
