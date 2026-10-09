import { useEffect, useRef, type RefObject } from 'react'

import { readPrefersReducedMotion, scrollIntoViewOptions } from './participantScrollView'

/** Brings the pressed chip into view when the active one changes; the first render never scrolls. */
export function useRevealActiveChip(active: string): RefObject<HTMLDivElement | null> {
  const strip = useRef<HTMLDivElement | null>(null)
  const previousActive = useRef<string | undefined>(undefined)

  useEffect(() => {
    const wasActive = previousActive.current
    previousActive.current = active
    if (wasActive === undefined || wasActive === active) return
    strip.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView(scrollIntoViewOptions(readPrefersReducedMotion()))
  }, [active])

  return strip
}
