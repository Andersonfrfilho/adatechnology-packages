/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

import { adjustmentsToCssFilter } from '../lib/adjustments'
import { drawOriented, type DrawableImage } from '../lib/render'
import type { EditState, ImageEditorLabels, Point } from '../types'

const PREVIEW_LONG_SIDE = 720
const KEY_STEP = 0.02

type FocalPointPickerProps = {
  readonly image: DrawableImage
  readonly state: EditState
  readonly labels: ImageEditorLabels
  readonly onChange: (point: Point) => void
}

export function FocalPointPicker({ image, state, labels, onChange }: FocalPointPickerProps): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { crop, focalPoint } = state

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const scale = Math.min(1, PREVIEW_LONG_SIDE / Math.max(crop.width, crop.height))
    canvas.width = Math.max(1, Math.round(crop.width * scale))
    canvas.height = Math.max(1, Math.round(crop.height * scale))
    drawOriented({ context, image, state, scale, origin: { x: crop.x, y: crop.y } })
    // desenha só quando o recorte ou a orientação mudam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, crop, state.rotation, state.isFlippedHorizontally, state.isFlippedVertically])

  function pointFrom(event: PointerEvent<HTMLDivElement>): Point {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId)
    onChange(pointFrom(event))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const step = event.shiftKey ? KEY_STEP * 5 : KEY_STEP
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
    if (!delta) return
    event.preventDefault()
    onChange({ x: focalPoint.x + delta[0]!, y: focalPoint.y + delta[1]! })
  }

  const percent = (value: number): number => Math.round(value * 100)
  const pinStyle = { left: `${focalPoint.x * 100}%`, top: `${focalPoint.y * 100}%` } as CSSProperties
  const previewStyle = { aspectRatio: `${crop.width} / ${crop.height}` } as CSSProperties

  return (
    <div className="aie-focus">
      <div
        className="aie-focus-preview"
        style={previewStyle}
        role="slider"
        tabIndex={0}
        aria-label={labels.focusPoint}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent(focalPoint.x)}
        aria-valuetext={`${percent(focalPoint.x)}% · ${percent(focalPoint.y)}%`}
        onPointerDown={handlePointerDown}
        onPointerMove={(event) => event.buttons > 0 && onChange(pointFrom(event))}
        onKeyDown={handleKeyDown}
      >
        <canvas ref={canvasRef} className="aie-canvas" style={{ filter: adjustmentsToCssFilter(state.adjustments) }} />
        <span className="aie-pin" style={pinStyle} />
      </div>
    </div>
  )
}
