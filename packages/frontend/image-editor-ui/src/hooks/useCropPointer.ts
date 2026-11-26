/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Arrastar o quadro, puxar uma alça e pinça com dois dedos, tudo pelos pointer events.
 */

import { useRef, type PointerEvent, type RefObject } from 'react'

import { applyZoom, moveRect, resizeRect, zoomOf } from '../lib/geometry'
import type { CropHandle, Point, Rect, Size } from '../types'

type Drag = {
  readonly kind: 'move' | 'resize'
  readonly handle?: CropHandle
  readonly start: Point
  readonly rect: Rect
}
type Pinch = { readonly distance: number; readonly zoom: number }

type UseCropPointerParams = {
  readonly surfaceRef: RefObject<HTMLElement | null>
  readonly crop: Rect
  readonly bounds: Size
  readonly aspect: number | undefined
  readonly onCropChange: (crop: Rect) => void
}

export function useCropPointer({ surfaceRef, crop, bounds, aspect, onCropChange }: UseCropPointerParams) {
  const pointers = useRef(new Map<number, Point>())
  const drag = useRef<Drag | undefined>(undefined)
  const pinch = useRef<Pinch | undefined>(undefined)

  function toImagePoint(event: PointerEvent): Point {
    const box = surfaceRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return { x: 0, y: 0 }
    return {
      x: ((event.clientX - box.left) / box.width) * bounds.width,
      y: ((event.clientY - box.top) / box.height) * bounds.height,
    }
  }

  function pinchDistance(): number {
    const [first, second] = [...pointers.current.values()]
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      drag.current = undefined
      pinch.current = { distance: pinchDistance(), zoom: zoomOf({ rect: crop, bounds, aspect }) }
      return
    }
    const target = event.target as HTMLElement
    const handle = target.dataset['handle'] as CropHandle | undefined
    if (handle) drag.current = { kind: 'resize', handle, start: toImagePoint(event), rect: crop }
    else if (target.dataset['role'] === 'frame') drag.current = { kind: 'move', start: toImagePoint(event), rect: crop }
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>): void {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pinch.current && pinch.current.distance > 0) {
      const zoom = pinch.current.zoom * (pinchDistance() / pinch.current.distance)
      onCropChange(applyZoom({ rect: crop, zoom, bounds, aspect }))
      return
    }
    const current = drag.current
    if (!current) return
    const point = toImagePoint(event)
    if (current.kind === 'move') {
      onCropChange(
        moveRect({ rect: current.rect, delta: { x: point.x - current.start.x, y: point.y - current.start.y }, bounds }),
      )
    } else if (current.handle) {
      onCropChange(resizeRect({ rect: current.rect, handle: current.handle, pointer: point, bounds, aspect }))
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>): void {
    pointers.current.delete(event.pointerId)
    pinch.current = undefined
    drag.current = undefined
  }

  return { handlePointerDown, handlePointerMove, handlePointerUp }
}
