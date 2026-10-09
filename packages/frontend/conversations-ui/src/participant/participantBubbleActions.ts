import type { ParticipantTimelineItem } from './participantMessages'

export type ParticipantBubbleActions = {
  readonly onRetry?: () => void
  readonly onDiscard?: () => void
  readonly onEdit?: () => void
}

export type ParticipantBubbleHandlers = {
  readonly retryLocal: () => void
  readonly discardLocal: () => void
  readonly editLocal: () => void
  /** Absent when the host did not pass onRetryPending: there is no way to resend what is in its queue. */
  readonly retryHost?: () => void
}

/** Same handlers, addressed by clientMessageId; the thread binds them to each bubble. */
export type ParticipantPendingActions = {
  readonly retryLocal: (clientMessageId: string) => void
  readonly discardLocal: (clientMessageId: string) => void
  readonly editLocal: (clientMessageId: string) => void
  readonly retryHost?: (clientMessageId: string) => void
}

export function bindPendingActions(actions: ParticipantPendingActions, clientMessageId: string): ParticipantBubbleHandlers {
  const { retryHost } = actions
  return {
    retryLocal: () => actions.retryLocal(clientMessageId),
    discardLocal: () => actions.discardLocal(clientMessageId),
    editLocal: () => actions.editLocal(clientMessageId),
    ...(retryHost ? { retryHost: () => retryHost(clientMessageId) } : {}),
  }
}

/** Only a failed pending can act; a failed server message has no way to be resent, so it just says "Failed". */
export function resolveParticipantBubbleActions(item: ParticipantTimelineItem, handlers: ParticipantBubbleHandlers): ParticipantBubbleActions {
  if (item.kind === 'server' || item.displayState !== 'failed') return {}
  if (item.origin === 'host') return handlers.retryHost ? { onRetry: handlers.retryHost } : {}
  return { onRetry: handlers.retryLocal, onDiscard: handlers.discardLocal, onEdit: handlers.editLocal }
}
