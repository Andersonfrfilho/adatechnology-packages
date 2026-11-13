import { useLayoutEffect, useState, type RefObject } from 'react'

const SCROLLER_SELECTOR = '.cv-p-thread__scroll'

/**
 * A panel under a bubble opens downwards; when that would cross the bottom of the thread's scrolling area (the
 * last messages), it opens upwards instead, so it is never cut off.
 */
export function useOpenUpwards(isOpen: boolean, panelRef: RefObject<HTMLElement | null>): boolean {
  const [isUpwards, setUpwards] = useState(false)
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!isOpen || !panel) {
      setUpwards(false)
      return
    }
    const scroller = panel.closest(SCROLLER_SELECTOR)
    if (!scroller) return
    setUpwards(panel.getBoundingClientRect().bottom > scroller.getBoundingClientRect().bottom)
  }, [isOpen, panelRef])
  return isUpwards
}
