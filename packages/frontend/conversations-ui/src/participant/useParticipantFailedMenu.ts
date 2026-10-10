import { useReducer, useRef, type FocusEvent, type KeyboardEvent, type RefObject } from 'react'

import { handleFailedMenuKeyDown } from './failedMenuKeyboard'
import {
  CLOSED_FAILED_MENU,
  failedMenuReducer,
  resolveFailedMenuTriggerKey,
  type FailedMenuPlacement,
  type FailedMenuState,
} from './participantFailedMenuState'
import { useFailedMenuInitialFocus, useFailedMenuOutsideClose, useFailedMenuPlacement } from './useFailedMenuEffects'

export type ParticipantFailedMenuController = {
  readonly state: FailedMenuState
  readonly placement: FailedMenuPlacement
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

  useFailedMenuInitialFocus(state, menuRef)
  useFailedMenuOutsideClose(state.isOpen, containerRef, dispatch)
  const placement = useFailedMenuPlacement(state.isOpen, { triggerRef, menuRef })

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const initialFocus = resolveFailedMenuTriggerKey(event.key)
    if (!initialFocus) return
    event.preventDefault()
    dispatch({ type: 'open', initialFocus })
  }

  function handleBlur(event: FocusEvent<HTMLSpanElement>): void {
    const next = event.relatedTarget
    if (next instanceof Node && !containerRef.current?.contains(next)) dispatch({ type: 'close' })
  }

  return {
    state,
    placement,
    containerRef,
    triggerRef,
    menuRef,
    handleTriggerClick: () => dispatch({ type: 'toggle' }),
    handleTriggerKeyDown,
    handleMenuKeyDown: (event) => handleFailedMenuKeyDown({ event, menuRef, triggerRef, dispatch }),
    handleBlur,
    close: () => dispatch({ type: 'close' }),
  }
}
