/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A aresta do editor, com o botão de desligar em cima dela.
 *
 * Existe porque desligar um fio não tinha caminho nenhum no canvas: as arestas são derivadas do
 * grafo a cada render, então clicar e apertar Delete não tem onde guardar a seleção. O botão no
 * hover resolve sem estado de seleção — e é o único lugar em que a pessoa já está olhando quando
 * quer trocar o destino.
 */

import { useEffect, useRef, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'

/** Folga para o ponteiro sair do traço e alcançar o botão sem que ele desapareça no caminho. */
const HIDE_DELAY_MS = 320

export type FlowConnectionEdgeData = {
  /** Ausente em aresta que não se desliga daqui (salto entre fluxos via portal). */
  readonly onDisconnect?: (() => void) | undefined
  readonly disconnectLabel: string
}

export function FlowConnectionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
  interactionWidth,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { onDisconnect, disconnectLabel } = (data ?? {}) as FlowConnectionEdgeData

  // Sair do traço não esconde o botão na hora: entre o fio e o botão há um vão de alguns pixels, e
  // esconder no `mouseleave` seco fazia o alvo fugir do mouse a caminho dele.
  function show() {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setHovered(true)
  }

  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setHovered(false), HIDE_DELAY_MS)
  }

  useEffect(() => () => clearTimeout(hideTimer.current), [])

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={interactionWidth ?? 20} />

      {/* Faixa invisível larga por cima do traço: o traço tem ~1,5px e mirar nele com o mouse é
          tarefa de precisão que ninguém deveria ter. */}
      <path
        d={path}
        fill="none"
        strokeWidth={22}
        stroke="transparent"
        className="react-flow__edge-interaction"
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      />

      {onDisconnect && hovered && (
        <EdgeLabelRenderer>
          <button
            type="button"
            data-cv-tooltip={disconnectLabel}
            aria-label={disconnectLabel}
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
            onClick={(event) => {
              event.stopPropagation()
              onDisconnect()
            }}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            className="nodrag nopan pointer-events-auto absolute flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm hover:border-red-400 hover:text-red-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const flowEdgeTypes = { flowConnection: FlowConnectionEdge }
