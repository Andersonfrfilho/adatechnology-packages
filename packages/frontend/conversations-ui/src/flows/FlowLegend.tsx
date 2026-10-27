/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Legenda do canvas.
 *
 * O editor distingue os tipos de ligação só por cor e traço — opção escolhida, fallback, salto entre
 * fluxos, conversa viva — e nada na tela dizia o que era o quê. Quem não desenhou o fluxo lia um
 * emaranhado colorido; a cor sem chave não informa, decora.
 *
 * Os contornos e marcas do card entram na mesma chave: card solto, início do fluxo e o ícone de
 * repetição são vocabulário do editor tanto quanto as cores dos fios.
 *
 * Recolhida por padrão: em canvas cheio, uma caixa fixa cobre card. Quem já conhece o vocabulário
 * não paga o espaço, e quem não conhece está a um clique.
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'

import type { FlowEditorLabels } from './labels'
import type { FlowNodeType } from './flowGraph'

export type FlowLegendEdgeSample = {
  readonly color: string
  readonly dash?: string | undefined
  readonly label: string
}

export type FlowLegendProps = {
  readonly labels: FlowEditorLabels
  readonly edgeSamples: readonly FlowLegendEdgeSample[]
  /** Classe de cor por tipo de card — a mesma que o `FlowNodeCard` usa, para a chave bater. */
  readonly nodeSwatches: readonly { readonly type: FlowNodeType; readonly className: string }[]
}

function EdgeSample({ sample }: { sample: FlowLegendEdgeSample }) {
  return (
    <li className="flex items-center gap-2">
      <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true" className="shrink-0">
        <line
          x1="2"
          y1="6"
          x2="26"
          y2="6"
          stroke={sample.color}
          strokeWidth="1.75"
          {...(sample.dash ? { strokeDasharray: sample.dash } : {})}
        />
      </svg>
      <span className="text-[11px] leading-tight text-gray-600 dark:text-gray-300">{sample.label}</span>
    </li>
  )
}

export function FlowLegend({ labels, edgeSamples, nodeSwatches }: FlowLegendProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        data-cv-tooltip={labels.legendPanel.title}
        aria-label={labels.legendPanel.title}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
      >
        {labels.legendPanel.title}
        {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>

      {open && (
        <div className="max-h-72 w-64 overflow-y-auto border-t border-gray-100 px-2.5 py-2 dark:border-gray-700">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {labels.legendPanel.connections}
          </p>
          <ul className="space-y-1.5">
            {edgeSamples.map((sample) => (
              <EdgeSample key={sample.label} sample={sample} />
            ))}
          </ul>

          <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {labels.legendPanel.nodes}
          </p>
          <ul className="space-y-1.5">
            {nodeSwatches.map((swatch) => (
              <li key={swatch.type} className="flex items-center gap-2">
                <span className={`h-3 w-5 shrink-0 rounded border-2 ${swatch.className}`} aria-hidden="true" />
                <span className="text-[11px] leading-tight text-gray-600 dark:text-gray-300">
                  {labels.legend[swatch.type]}
                </span>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <span
                className="h-3 w-5 shrink-0 rounded border-2 border-dashed border-amber-400"
                aria-hidden="true"
              />
              <span className="text-[11px] leading-tight text-gray-600 dark:text-gray-300">
                {labels.legendPanel.detached}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-3 w-5 shrink-0 items-center justify-center" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] leading-tight text-gray-600 dark:text-gray-300">
                {labels.legendPanel.startNode}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-3 w-5 shrink-0 items-center justify-center text-gray-400" aria-hidden="true">
                <RotateCcw size={12} strokeWidth={2.5} />
              </span>
              <span className="text-[11px] leading-tight text-gray-600 dark:text-gray-300">
                {labels.legendPanel.selfLoop}
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
