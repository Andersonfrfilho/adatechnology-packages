import { describe, expect, it } from 'bun:test'

import {
  CLOSED_FAILED_MENU,
  failedMenuReducer,
  resolveFailedMenuKey,
  resolveFailedMenuTriggerKey,
} from './participantFailedMenuState'

describe('failed menu state', () => {
  it('toggles open on first focus item and closes again', () => {
    const open = failedMenuReducer(CLOSED_FAILED_MENU, { type: 'toggle' })
    expect(open).toEqual({ isOpen: true, initialFocus: 'first' })
    expect(failedMenuReducer(open, { type: 'toggle' })).toEqual(CLOSED_FAILED_MENU)
  })

  it('opens on the last item when asked and ignores a close while closed', () => {
    expect(failedMenuReducer(CLOSED_FAILED_MENU, { type: 'open', initialFocus: 'last' }).initialFocus).toBe('last')
    expect(failedMenuReducer(CLOSED_FAILED_MENU, { type: 'close' })).toBe(CLOSED_FAILED_MENU)
  })
})

describe('failed menu keyboard', () => {
  it('Escape closes and gives the focus back to the trigger', () => {
    expect(resolveFailedMenuKey({ key: 'Escape', index: 0, count: 2 })).toEqual({ type: 'close', shouldRestoreFocus: true })
  })

  it('Tab closes without trapping: focus is not pulled back', () => {
    expect(resolveFailedMenuKey({ key: 'Tab', index: 1, count: 2 })).toEqual({ type: 'close', shouldRestoreFocus: false })
  })

  it('arrows wrap around, Home and End jump', () => {
    expect(resolveFailedMenuKey({ key: 'ArrowDown', index: 1, count: 2 })).toEqual({ type: 'focus', index: 0 })
    expect(resolveFailedMenuKey({ key: 'ArrowUp', index: 0, count: 2 })).toEqual({ type: 'focus', index: 1 })
    expect(resolveFailedMenuKey({ key: 'Home', index: 1, count: 2 })).toEqual({ type: 'focus', index: 0 })
    expect(resolveFailedMenuKey({ key: 'End', index: 0, count: 2 })).toEqual({ type: 'focus', index: 1 })
    expect(resolveFailedMenuKey({ key: 'a', index: 0, count: 2 })).toBeUndefined()
  })

  it('ArrowDown and ArrowUp open the menu from the trigger on the matching end', () => {
    expect(resolveFailedMenuTriggerKey('ArrowDown')).toBe('first')
    expect(resolveFailedMenuTriggerKey('ArrowUp')).toBe('last')
    expect(resolveFailedMenuTriggerKey('Enter')).toBeUndefined()
  })
})
