/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Quadro de largura fixa que encolhe para caber no espaço que o painel tem. `zoom` (e não
 * `transform`) encolhe também a caixa no layout, sem deixar rombo branco ao lado e embaixo.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { fitZoom } from '../previewDevice.util'

export type ScaledPreviewFrameProps = {
  readonly width: number
  readonly children: ReactNode
}

export function ScaledPreviewFrame({ width, children }: ScaledPreviewFrameProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const update = () => setZoom(fitZoom(host.clientWidth, width))
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(host)
    return () => observer.disconnect()
  }, [width])

  return (
    <div ref={hostRef} className="adn-scaled-frame">
      <div className="adn-scaled-frame__inner" style={{ width, zoom }}>
        {children}
      </div>
    </div>
  )
}
