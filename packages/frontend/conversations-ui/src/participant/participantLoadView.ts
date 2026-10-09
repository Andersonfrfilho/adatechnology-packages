export type ParticipantLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export type ResolveLoadViewParams = {
  readonly status: ParticipantLoadStatus
  readonly hasItems: boolean
}

export type ParticipantLoadView = {
  readonly isLoading: boolean
  readonly hasError: boolean
  /** Only after a successful load: an error or a pending load never draws the empty state. */
  readonly isEmpty: boolean
}

export function resolveLoadView({ status, hasItems }: ResolveLoadViewParams): ParticipantLoadView {
  return {
    isLoading: (status === 'idle' || status === 'loading') && !hasItems,
    hasError: status === 'error',
    isEmpty: status === 'ready' && !hasItems,
  }
}
