/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Controle deslizante próprio (role="slider"): o `<input type="range">` nativo muda de cara em cada navegador.
 */

import { useId, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

type SliderProps = {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly valueText?: string
  readonly onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step, valueText, onChange }: SliderProps): ReactNode {
  const labelId = useId()
  const trackRef = useRef<HTMLDivElement>(null)
  const range = max - min
  const position = (value - min) / range

  function commit(next: number): void {
    const stepped = Math.round((next - min) / step) * step + min
    onChange(Math.min(max, Math.max(min, Number(stepped.toFixed(4)))))
  }

  function handlePointer(event: PointerEvent<HTMLDivElement>): void {
    const bounds = trackRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width === 0) return
    commit(min + range * Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)))
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId)
    handlePointer(event)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const big = step * 10
    const deltas: Readonly<Record<string, number>> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: big, PageDown: -big }
    const delta = deltas[event.key]
    if (event.key === 'Home') commit(min)
    else if (event.key === 'End') commit(max)
    else if (delta !== undefined) commit(value + delta)
    else return
    event.preventDefault()
  }

  return (
    <div className="aie-slider">
      <div className="aie-slider-head">
        <span id={labelId}>{label}</span>
        <output>{valueText ?? value}</output>
      </div>
      <div
        ref={trackRef}
        className="aie-slider-track"
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        style={{ '--aie-position': position } as CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={(event) => event.buttons > 0 && handlePointer(event)}
        onKeyDown={handleKeyDown}
      >
        <span className="aie-slider-rail" />
        <span className="aie-slider-fill" />
        <span className="aie-slider-thumb" />
      </div>
    </div>
  )
}
