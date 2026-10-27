import type { Dispatch, KeyboardEvent, RefObject } from 'react'

import { resolveFailedMenuKey, type FailedMenuAction } from './participantFailedMenuState'

type MenuKeyParams = {
  readonly event: KeyboardEvent<HTMLElement>
  readonly menuRef: RefObject<HTMLElement | null>
  readonly triggerRef: RefObject<HTMLElement | null>
  readonly dispatch: Dispatch<FailedMenuAction>
}

/** Escape is consumed here so it does not also close a host dialog or drawer around the thread. */
export function handleFailedMenuKeyDown({ event, menuRef, triggerRef, dispatch }: MenuKeyParams): void {
  const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
  const index = items.findIndex((item) => item === document.activeElement)
  const result = resolveFailedMenuKey({ key: event.key, index, count: items.length })
  if (!result) return
  if (result.type === 'focus') {
    event.preventDefault()
    items[result.index]?.focus()
    return
  }
  if (result.shouldRestoreFocus) {
    event.preventDefault()
    event.stopPropagation()
    triggerRef.current?.focus()
  }
  dispatch({ type: 'close' })
}
