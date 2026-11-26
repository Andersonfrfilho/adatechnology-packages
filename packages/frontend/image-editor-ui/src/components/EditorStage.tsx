/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'

import { useCropPointer } from '../hooks/useCropPointer'
import { adjustmentsToCssFilter } from '../lib/adjustments'
import { boundsOf } from '../lib/editState'
import { applyZoom, moveRect, resizeRect, zoomOf } from '../lib/geometry'
import { drawOriented, type DrawableImage } from '../lib/render'
import type { CropHandle, EditState, ImageEditorLabels, Rect, Size } from '../types'

const CORNER_HANDLES: readonly CropHandle[] = ['nw', 'ne', 'se', 'sw']
const ALL_HANDLES: readonly CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const KEY_STEP_RATIO = 0.01
const ZOOM_KEY_STEP = 0.1

type EditorStageProps = {
  readonly image: DrawableImage
  readonly state: EditState
  readonly aspect: number | undefined
  readonly labels: ImageEditorLabels
  readonly helpId: string
  readonly onCropChange: (crop: Rect) => void
}

function fitInside(params: { readonly box: Size; readonly bounds: Size }): Size {
  const scale = Math.min(params.box.width / params.bounds.width, params.box.height / params.bounds.height)
  return { width: Math.max(1, Math.floor(params.bounds.width * scale)), height: Math.max(1, Math.floor(params.bounds.height * scale)) }
}

function useBoxSize(): { readonly ref: React.RefObject<HTMLDivElement | null>; readonly size: Size } {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, size }
}

function toPercent(value: number, total: number): string {
  return `${(value / total) * 100}%`
}

export function EditorStage({ image, state, aspect, labels, helpId, onCropChange }: EditorStageProps): ReactNode {
  const { ref: boxRef, size: box } = useBoxSize()
  const surfaceRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bounds = boundsOf(state)
  const display = box.width > 0 ? fitInside({ box, bounds }) : { width: 0, height: 0 }
  const pointer = useCropPointer({ surfaceRef, crop: state.crop, bounds, aspect, onCropChange })

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || display.width === 0) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.round(display.width * ratio)
    canvas.height = Math.round(display.height * ratio)
    drawOriented({ context, image, state, scale: canvas.width / bounds.width, origin: { x: 0, y: 0 } })
    // o desenho depende só da orientação e do tamanho; recorte e ajustes não redesenham
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, state.rotation, state.isFlippedHorizontally, state.isFlippedVertically, display.width, display.height])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const step = Math.min(bounds.width, bounds.height) * KEY_STEP_RATIO * (event.shiftKey ? 5 : 1)
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    const zoom = zoomOf({ rect: state.crop, bounds, aspect })
    if (direction && event.altKey && aspect === undefined) {
      const { x, y, width, height } = state.crop
      const corner = { x: x + width + direction[0]! * step, y: y + height + direction[1]! * step }
      onCropChange(resizeRect({ rect: state.crop, handle: 'se', pointer: corner, bounds, aspect }))
    } else if (direction) onCropChange(moveRect({ rect: state.crop, delta: { x: direction[0]! * step, y: direction[1]! * step }, bounds }))
    else if (event.key === '+' || event.key === '=') onCropChange(applyZoom({ rect: state.crop, zoom: zoom + ZOOM_KEY_STEP, bounds, aspect }))
    else if (event.key === '-') onCropChange(applyZoom({ rect: state.crop, zoom: zoom - ZOOM_KEY_STEP, bounds, aspect }))
    else return
    event.preventDefault()
  }

  const { crop } = state
  const frameStyle = {
    left: toPercent(crop.x, bounds.width),
    top: toPercent(crop.y, bounds.height),
    width: toPercent(crop.width, bounds.width),
    height: toPercent(crop.height, bounds.height),
  } as CSSProperties
  const surfaceStyle = { width: display.width, height: display.height } as CSSProperties
  const handles = aspect === undefined ? ALL_HANDLES : CORNER_HANDLES

  return (
    <div ref={boxRef} className="aie-stage">
      <div
        ref={surfaceRef}
        className="aie-surface"
        style={surfaceStyle}
        onPointerDown={pointer.handlePointerDown}
        onPointerMove={pointer.handlePointerMove}
        onPointerUp={pointer.handlePointerUp}
        onPointerCancel={pointer.handlePointerUp}
      >
        <canvas ref={canvasRef} className="aie-canvas" style={{ filter: adjustmentsToCssFilter(state.adjustments) }} />
        <div
          className="aie-frame"
          data-role="frame"
          role="group"
          tabIndex={0}
          aria-label={labels.cropFrame}
          aria-describedby={helpId}
          style={frameStyle}
          onKeyDown={handleKeyDown}
        >
          {handles.map((handle) => (
            <span key={handle} className="aie-handle" data-handle={handle} />
          ))}
        </div>
      </div>
    </div>
  )
}
