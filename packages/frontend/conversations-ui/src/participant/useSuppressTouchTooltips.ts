import { useEffect, type RefObject } from 'react'

/**
 * Keeps the package tooltip layer (which listens on the document) from lighting up for touch: a tap
 * focuses the button on Android and the balloon would stay on. The events are stopped at the thread
 * root, so the layer keeps its behavior for every other flow.
 */
export function useSuppressTouchTooltips(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    let isTouching = false

    function handlePointerDown(event: PointerEvent): void {
      isTouching = event.pointerType === 'touch'
    }
    function handlePointerOver(event: PointerEvent): void {
      if (event.pointerType === 'touch') event.stopPropagation()
    }
    function handleFocusIn(event: Event): void {
      if (isTouching) event.stopPropagation()
    }
    function handleKeyDown(): void {
      isTouching = false
    }

    root.addEventListener('pointerdown', handlePointerDown, true)
    root.addEventListener('pointerover', handlePointerOver)
    root.addEventListener('focusin', handleFocusIn)
    root.addEventListener('keydown', handleKeyDown, true)
    return () => {
      root.removeEventListener('pointerdown', handlePointerDown, true)
      root.removeEventListener('pointerover', handlePointerOver)
      root.removeEventListener('focusin', handleFocusIn)
      root.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [rootRef])
}
