import { useCallback, type RefObject } from 'react'

import { readPrefersReducedMotion, scrollToLatestOptions } from './participantScrollView'

export type UseScrollAwayStateResult = {
  readonly isAwayFromBottom: boolean
  readonly scrollToLatest: () => void
}

/** Away is the negation of the near-the-end state useStickToBottom already tracks with shouldStickToBottom. */
export function useScrollAwayState(
  ref: RefObject<HTMLDivElement | null>,
  isNearBottom: boolean,
): UseScrollAwayStateResult {
  const scrollToLatest = useCallback((): void => {
    const element = ref.current
    if (!element) return
    element.scrollTo(
      scrollToLatestOptions({ scrollHeight: element.scrollHeight, isReducedMotion: readPrefersReducedMotion() }),
    )
  }, [ref])

  return { isAwayFromBottom: !isNearBottom, scrollToLatest }
}
