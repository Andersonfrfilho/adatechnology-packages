import { useEffect, useReducer, useRef, type FocusEvent, type KeyboardEvent, type RefObject } from 'react'

import {
  CLOSED_FAILED_MENU,
  failedMenuReducer,
  resolveFailedMenuKey,
  resolveFailedMenuTriggerKey,
  type FailedMenuState,
} from './participantFailedMenuState'

export type ParticipantFailedMenuController = {
  readonly state: FailedMenuState
  readonly containerRef: RefObject<HTMLSpanElement | null>
  readonly triggerRef: RefObject<HTMLButtonElement | null>
  readonly menuRef: RefObject<HTMLDivElement | null>
  readonly handleTriggerClick: () => void
  readonly handleTriggerKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  readonly handleMenuKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  readonly handleBlur: (event: FocusEvent<HTMLSpanElement>) => void
  readonly close: () => void
}

export function useParticipantFailedMenu(): ParticipantFailedMenuController {
  const [state, dispatch] = useReducer(failedMenuReducer, CLOSED_FAILED_MENU)
  const containerRef = useRef<HTMLSpanElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  function items(): HTMLElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
  }

  useEffect(() => {
    if (!state.isOpen) return
    const entries = items()
    ;(state.initialFocus === 'last' ? entries[entries.length - 1] : entries[0])?.focus()
  }, [state])

  useEffect(() => {
    if (!state.isOpen) return
    function handlePointerDown(event: PointerEvent): void {
      if (event.target instanceof Node && containerRef.current?.contains(event.target)) return
      dispatch({ type: 'close' })
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [state.isOpen])

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const initialFocus = resolveFailedMenuTriggerKey(event.key)
    if (!initialFocus) return
    event.preventDefault()
    dispatch({ type: 'open', initialFocus })
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const entries = items()
    const index = entries.findIndex((entry) => entry === document.activeElement)
    const result = resolveFailedMenuKey({ key: event.key, index, count: entries.length })
    if (!result) return
    if (result.type === 'focus') {
      event.preventDefault()
      entries[result.index]?.focus()
      return
    }
    if (result.shouldRestoreFocus) {
      event.preventDefault()
      triggerRef.current?.focus()
    }
    dispatch({ type: 'close' })
  }

  function handleBlur(event: FocusEvent<HTMLSpanElement>): void {
    const next = event.relatedTarget
    if (next instanceof Node && !containerRef.current?.contains(next)) dispatch({ type: 'close' })
  }

  return {
    state,
    containerRef,
    triggerRef,
    menuRef,
    handleTriggerClick: () => dispatch({ type: 'toggle' }),
    handleTriggerKeyDown,
    handleMenuKeyDown,
    handleBlur,
    close: () => dispatch({ type: 'close' }),
  }
}
