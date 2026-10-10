import { useEffect, useLayoutEffect, useState, type Dispatch, type RefObject } from 'react'

import {
  resolveFailedMenuPlacement,
  type FailedMenuAction,
  type FailedMenuPlacement,
  type FailedMenuState,
} from './participantFailedMenuState'

const SCROLLER_SELECTOR = '.cv-p-thread__scroll'

export function useFailedMenuInitialFocus(state: FailedMenuState, menuRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    if (!state.isOpen) return
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const target = state.initialFocus === 'last' ? items[items.length - 1] : items[0]
    target?.focus()
  }, [state, menuRef])
}

export function useFailedMenuOutsideClose(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement | null>,
  dispatch: Dispatch<FailedMenuAction>,
): void {
  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(event: PointerEvent): void {
      if (event.target instanceof Node && containerRef.current?.contains(event.target)) return
      dispatch({ type: 'close' })
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, containerRef, dispatch])
}

type PlacementRefs = {
  readonly triggerRef: RefObject<HTMLElement | null>
  readonly menuRef: RefObject<HTMLElement | null>
}

export function useFailedMenuPlacement(isOpen: boolean, { triggerRef, menuRef }: PlacementRefs): FailedMenuPlacement {
  const [placement, setPlacement] = useState<FailedMenuPlacement>('above')
  useLayoutEffect(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!isOpen || !trigger || !menu) return
    const anchor = trigger.closest('.cv-p-bubble') ?? trigger
    const scroller = trigger.closest(SCROLLER_SELECTOR)
    setPlacement(
      resolveFailedMenuPlacement({
        anchorTop: anchor.getBoundingClientRect().top,
        scrollerTop: scroller?.getBoundingClientRect().top ?? 0,
        menuHeight: menu.getBoundingClientRect().height,
      }),
    )
  }, [isOpen, triggerRef, menuRef])
  return placement
}
