export type FailedMenuFocus = 'first' | 'last'

export type FailedMenuState = { readonly isOpen: boolean; readonly initialFocus: FailedMenuFocus }

export type FailedMenuAction =
  | { readonly type: 'open'; readonly initialFocus: FailedMenuFocus }
  | { readonly type: 'close' }
  | { readonly type: 'toggle' }

export const CLOSED_FAILED_MENU: FailedMenuState = { isOpen: false, initialFocus: 'first' }

export function failedMenuReducer(state: FailedMenuState, action: FailedMenuAction): FailedMenuState {
  if (action.type === 'open') return { isOpen: true, initialFocus: action.initialFocus }
  if (action.type === 'close') return state.isOpen ? CLOSED_FAILED_MENU : state
  return state.isOpen ? CLOSED_FAILED_MENU : { isOpen: true, initialFocus: 'first' }
}

export type FailedMenuKeyResult =
  | { readonly type: 'focus'; readonly index: number }
  | { readonly type: 'close'; readonly shouldRestoreFocus: boolean }

type MenuKeyParams = { readonly key: string; readonly index: number; readonly count: number }

/** Roving focus inside the open menu; Tab is never trapped, it closes the menu and lets focus move on. */
export function resolveFailedMenuKey({ key, index, count }: MenuKeyParams): FailedMenuKeyResult | undefined {
  if (key === 'Escape') return { type: 'close', shouldRestoreFocus: true }
  if (key === 'Tab') return { type: 'close', shouldRestoreFocus: false }
  if (key === 'ArrowDown') return { type: 'focus', index: (index + 1) % count }
  if (key === 'ArrowUp') return { type: 'focus', index: (index - 1 + count) % count }
  if (key === 'Home') return { type: 'focus', index: 0 }
  if (key === 'End') return { type: 'focus', index: count - 1 }
  return undefined
}

/** Keys that open the menu from its trigger; Enter and Space already open it through the click. */
export function resolveFailedMenuTriggerKey(key: string): FailedMenuFocus | undefined {
  if (key === 'ArrowDown') return 'first'
  if (key === 'ArrowUp') return 'last'
  return undefined
}
