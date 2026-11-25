/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Destinos que uma action pode devolver em `next` (`possibleNext`). Não muda o que o bot faz — o
 * handler decide na hora —; serve para o mapa desenhar esses caminhos e a validação não acusar o
 * destino de inalcançável.
 */

import type { ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { FlowNodeData } from './flowGraph'
import { OPTIONAL_RUNNER_FIELD_LABEL_DEFAULTS, type FlowRunnerFieldLabels } from './labels'
import { PANEL_FIELD_CLASSNAME, PANEL_HINT_CLASSNAME, PANEL_LABEL_CLASSNAME } from './flowPanelStyles'

export type FlowPossibleNextFieldProps = {
  draft: FlowNodeData
  onDraftChange: (update: (previous: FlowNodeData) => FlowNodeData) => void
  renderTargetOptions: () => ReactNode
  labels: FlowRunnerFieldLabels
}

function withPossibleNext(node: FlowNodeData, targets: string[]): FlowNodeData {
  return { ...node, possibleNext: targets.length > 0 ? targets : undefined }
}

export function FlowPossibleNextField({
  draft,
  onDraftChange,
  renderTargetOptions,
  labels,
}: FlowPossibleNextFieldProps) {
  const defaults = OPTIONAL_RUNNER_FIELD_LABEL_DEFAULTS
  const targets = draft.possibleNext ?? []
  const addLabel = labels.addPossibleNext ?? defaults.addPossibleNext
  const removeLabel = labels.removePossibleNext ?? defaults.removePossibleNext
  const fieldLabel = labels.possibleNext ?? defaults.possibleNext

  function updateTarget(index: number, value: string) {
    const next = targets.map((target, targetIndex) => (targetIndex === index ? value : target))
    onDraftChange((previous) => withPossibleNext(previous, next))
  }

  return (
    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <label className={PANEL_LABEL_CLASSNAME}>{fieldLabel}</label>
        <button
          type="button"
          aria-label={addLabel}
          onClick={() => onDraftChange((previous) => withPossibleNext(previous, [...targets, '']))}
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          <Plus size={12} aria-hidden="true" /> {addLabel}
        </button>
      </div>
      <p className={PANEL_HINT_CLASSNAME}>{labels.possibleNextHint ?? defaults.possibleNextHint}</p>
      <div className="space-y-2 mt-1">
        {targets.map((target, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              value={target}
              aria-label={fieldLabel}
              onChange={(event) => updateTarget(index, event.target.value)}
              className={`flex-1 ${PANEL_FIELD_CLASSNAME}`}
            >
              <option value="">—</option>
              {renderTargetOptions()}
            </select>
            <button
              type="button"
              aria-label={removeLabel}
              onClick={() =>
                onDraftChange((previous) =>
                  withPossibleNext(
                    previous,
                    targets.filter((_, targetIndex) => targetIndex !== index),
                  ),
                )
              }
              className="text-gray-400 hover:text-red-600"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
