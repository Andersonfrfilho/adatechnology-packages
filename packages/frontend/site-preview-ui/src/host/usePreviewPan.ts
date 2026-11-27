/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A mão: uma camada sobre o iframe transforma o arrastar em rolagem do palco (para os lados) e da página (para cima e baixo).
 */
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

type UsePreviewPanParams = {
  readonly stageRef: RefObject<HTMLDivElement | null>
  readonly frameRef: RefObject<HTMLIFrameElement | null>
  readonly scale: number
}

type PanStart = {
  readonly pointerX: number
  readonly pointerY: number
  readonly scrollLeft: number
  readonly scrollTop: number
  readonly frameTop: number
}

function readFrameTop(frame: HTMLIFrameElement | null): number {
  try {
    return frame?.contentWindow?.scrollY ?? 0
  } catch {
    return 0
  }
}

export function usePreviewPan({ stageRef, frameRef, scale }: UsePreviewPanParams): {
  readonly isHandOn: boolean
  readonly isPanning: boolean
  readonly toggleHand: () => void
  readonly overlayHandlers: {
    readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void
    readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void
    readonly onPointerUp: () => void
    readonly onPointerCancel: () => void
  }
} {
  const [isHandOn, setIsHandOn] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const startRef = useRef<PanStart | undefined>(undefined)

  useEffect(() => {
    const stage = stageRef.current
    if (stage === null) return undefined
    function handleWheel(event: WheelEvent): void {
      if (!event.shiftKey || stage === null) return
      event.preventDefault()
      stage.scrollLeft += event.deltaX || event.deltaY
    }
    function listenInsideFrame(): (() => void) | undefined {
      try {
        const frameDocument = frameRef.current?.contentDocument
        frameDocument?.addEventListener('wheel', handleWheel, { passive: false })
        return () => frameDocument?.removeEventListener('wheel', handleWheel)
      } catch {
        return undefined
      }
    }
    let stopFrame = listenInsideFrame()
    const frame = frameRef.current
    function handleFrameLoad(): void {
      stopFrame?.()
      stopFrame = listenInsideFrame()
    }
    stage.addEventListener('wheel', handleWheel, { passive: false })
    frame?.addEventListener('load', handleFrameLoad)
    return () => {
      stage.removeEventListener('wheel', handleWheel)
      frame?.removeEventListener('load', handleFrameLoad)
      stopFrame?.()
    }
  }, [stageRef, frameRef])

  function handlePointerDown(event: PointerEvent<HTMLElement>): void {
    const stage = stageRef.current
    if (stage === null) return
    event.currentTarget.setPointerCapture(event.pointerId)
    startRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      scrollLeft: stage.scrollLeft,
      scrollTop: stage.scrollTop,
      frameTop: readFrameTop(frameRef.current),
    }
    setIsPanning(true)
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>): void {
    const start = startRef.current
    const stage = stageRef.current
    if (start === undefined || stage === null) return
    const deltaX = event.clientX - start.pointerX
    const deltaY = event.clientY - start.pointerY
    stage.scrollLeft = start.scrollLeft - deltaX
    stage.scrollTop = start.scrollTop - deltaY
    try {
      frameRef.current?.contentWindow?.scrollTo({ top: start.frameTop - deltaY / scale })
    } catch {
      // Cross-origin frame: only the stage scrolls.
    }
  }

  function endPan(): void {
    startRef.current = undefined
    setIsPanning(false)
  }

  return {
    isHandOn,
    isPanning,
    toggleHand: () => setIsHandOn((previous) => !previous),
    overlayHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endPan,
      onPointerCancel: endPan,
    },
  }
}
