import { useCallback, useLayoutEffect, useRef, useState, type RefObject, type UIEvent } from 'react'

import {
  NEAR_BOTTOM_THRESHOLD_PX,
  resolveScrollAction,
  scrollAnchorAfterPrepend,
  shouldStickToBottom,
} from './participantScroll'

export type UseStickToBottomParams = {
  readonly firstKey: string | undefined
  readonly lastKey: string | undefined
}

export type ParticipantThreadScroll = {
  readonly ref: RefObject<HTMLDivElement | null>
  readonly onScroll: (event: UIEvent<HTMLDivElement>) => void
  /** Absent draws no scroll-to-latest button. */
  readonly isAwayFromBottom?: boolean
  readonly scrollToLatest?: () => void
}

export type UseStickToBottomResult = {
  readonly scroll: ParticipantThreadScroll
  readonly isNearBottom: boolean
}

type Snapshot = {
  hasPositioned: boolean
  firstKey: string | undefined
  lastKey: string | undefined
  scrollTop: number
  scrollHeight: number
}

export function useStickToBottom({ firstKey, lastKey }: UseStickToBottomParams): UseStickToBottomResult {
  const ref = useRef<HTMLDivElement | null>(null)
  const snapshot = useRef<Snapshot>({
    hasPositioned: false,
    firstKey: undefined,
    lastKey: undefined,
    scrollTop: 0,
    scrollHeight: 0,
  })
  const [isNearBottom, setIsNearBottom] = useState(true)
  const isNearBottomRef = useRef(true)

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>): void => {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget
    const isNear = shouldStickToBottom({ scrollTop, clientHeight, scrollHeight, threshold: NEAR_BOTTOM_THRESHOLD_PX })
    snapshot.current.scrollTop = scrollTop
    snapshot.current.scrollHeight = scrollHeight
    isNearBottomRef.current = isNear
    setIsNearBottom(isNear)
  }, [])

  useLayoutEffect(() => {
    const element = ref.current
    const previous = snapshot.current
    if (!element) return
    const action = resolveScrollAction({
      hasPositioned: previous.hasPositioned,
      previousFirstKey: previous.firstKey,
      previousLastKey: previous.lastKey,
      firstKey,
      lastKey,
      wasNearBottom: isNearBottomRef.current,
    })
    if (action === 'bottom') {
      element.scrollTop = element.scrollHeight
      isNearBottomRef.current = true
      setIsNearBottom(true)
    }
    if (action === 'anchor') {
      element.scrollTop = scrollAnchorAfterPrepend({
        previousScrollTop: previous.scrollTop,
        previousScrollHeight: previous.scrollHeight,
        scrollHeight: element.scrollHeight,
      })
    }
    snapshot.current = {
      hasPositioned: previous.hasPositioned || action === 'bottom',
      firstKey,
      lastKey,
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
    }
  }, [firstKey, lastKey])

  return { scroll: { ref, onScroll }, isNearBottom }
}
