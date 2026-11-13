import { describe, expect, it } from 'bun:test'

import {
  NEAR_BOTTOM_THRESHOLD_PX,
  resolveScrollAction,
  scrollAnchorAfterPrepend,
  shouldStickToBottom,
} from './participantScroll'

describe('shouldStickToBottom', () => {
  const base = { clientHeight: 400, scrollHeight: 1000, threshold: 80 }

  it('is true at the very bottom', () => {
    expect(shouldStickToBottom({ ...base, scrollTop: 600 })).toBe(true)
  })

  it('is true within the threshold and false beyond it', () => {
    expect(shouldStickToBottom({ ...base, scrollTop: 520 })).toBe(true)
    expect(shouldStickToBottom({ ...base, scrollTop: 519 })).toBe(false)
  })

  it('is true when the content fits without scrolling', () => {
    expect(shouldStickToBottom({ scrollTop: 0, clientHeight: 400, scrollHeight: 300, threshold: 80 })).toBe(true)
  })

  it('uses an 80px default threshold', () => {
    expect(NEAR_BOTTOM_THRESHOLD_PX).toBe(80)
  })
})

describe('scrollAnchorAfterPrepend', () => {
  it('keeps the same message in view by adding the height that was prepended', () => {
    expect(scrollAnchorAfterPrepend({ previousScrollTop: 10, previousScrollHeight: 1000, scrollHeight: 1600 })).toBe(610)
  })

  it('does not move when nothing was prepended', () => {
    expect(scrollAnchorAfterPrepend({ previousScrollTop: 10, previousScrollHeight: 1000, scrollHeight: 1000 })).toBe(10)
  })
})

describe('resolveScrollAction', () => {
  const settled = { hasPositioned: true, previousFirstKey: 'a', previousLastKey: 'c', firstKey: 'a', lastKey: 'c', wasNearBottom: true }

  it('does nothing while there are no items', () => {
    expect(resolveScrollAction({ ...settled, hasPositioned: false, firstKey: undefined, lastKey: undefined })).toBe('none')
  })

  it('jumps to the bottom on the first load even when the user was not near the bottom', () => {
    expect(resolveScrollAction({ ...settled, hasPositioned: false, previousFirstKey: undefined, previousLastKey: undefined, wasNearBottom: false })).toBe('bottom')
  })

  it('follows a new last message only when the user was near the bottom', () => {
    expect(resolveScrollAction({ ...settled, lastKey: 'd' })).toBe('bottom')
    expect(resolveScrollAction({ ...settled, lastKey: 'd', wasNearBottom: false })).toBe('none')
  })

  it('anchors when older messages are prepended, whatever the position', () => {
    expect(resolveScrollAction({ ...settled, firstKey: 'z' })).toBe('anchor')
    expect(resolveScrollAction({ ...settled, firstKey: 'z', wasNearBottom: false })).toBe('anchor')
  })

  it('anchors when both ends changed but the user was reading', () => {
    expect(resolveScrollAction({ ...settled, firstKey: 'z', lastKey: 'd', wasNearBottom: false })).toBe('anchor')
  })

  it('does nothing when the keys are the same', () => {
    expect(resolveScrollAction(settled)).toBe('none')
  })
})
