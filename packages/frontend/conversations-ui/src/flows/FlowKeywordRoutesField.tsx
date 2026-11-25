/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas por palavra-chave (`next.byKeyword`): texto livre que contém a palavra leva ao destino.
 */

import type { ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { FlowNodeData } from './flowGraph'
import type { FlowRunnerFieldLabels } from './labels'
import { PANEL_FIELD_CLASSNAME, PANEL_HINT_CLASSNAME, PANEL_LABEL_CLASSNAME } from './flowPanelStyles'

export type FlowKeywordRoutesFieldProps = {
  draft: FlowNodeData
  onDraftChange: (update: (previous: FlowNodeData) => FlowNodeData) => void
  renderTargetOptions: () => ReactNode
  labels: FlowRunnerFieldLabels
}

function withRoutes(node: FlowNodeData, routes: [string, string][]): FlowNodeData {
  const current: Exclude<FlowNodeData['next'], string | undefined> =
    typeof node.next === 'object' && node.next ? node.next : { byAnswer: {}, default: node.next ?? '' }
  const rest = { ...current }
  delete rest.byKeyword
  return { ...node, next: routes.length > 0 ? { ...rest, byKeyword: Object.fromEntries(routes) } : rest }
}

export function FlowKeywordRoutesField({
  draft,
  onDraftChange,
  renderTargetOptions,
  labels,
}: FlowKeywordRoutesFieldProps) {
  const routes: [string, string][] =
    typeof draft.next === 'object' && draft.next?.byKeyword ? Object.entries(draft.next.byKeyword) : []

  function updateRoute(index: number, field: 0 | 1, value: string) {
    const next = routes.map((route, routeIndex): [string, string] => {
      if (routeIndex !== index) return route
      return field === 0 ? [value, route[1]] : [route[0], value]
    })
    onDraftChange((previous) => withRoutes(previous, next))
  }

  function addRoute() {
    onDraftChange((previous) => withRoutes(previous, [...routes, [labels.keywordPlaceholder, '']]))
  }

  function removeRoute(index: number) {
    onDraftChange((previous) =>
      withRoutes(
        previous,
        routes.filter((_, routeIndex) => routeIndex !== index),
      ),
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className={PANEL_LABEL_CLASSNAME}>{labels.keywordRoutes}</label>
        <button
          type="button"
          data-cv-tooltip={labels.addKeywordRoute}
          aria-label={labels.addKeywordRoute}
          onClick={addRoute}
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          <Plus size={12} aria-hidden="true" /> {labels.addKeywordRoute}
        </button>
      </div>
      <p className={PANEL_HINT_CLASSNAME}>{labels.keywordRoutesHint}</p>
      <div className="space-y-2 mt-1">
        {routes.map(([keyword, target], index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={keyword}
              aria-label={labels.keywordRoutes}
              onChange={(event) => updateRoute(index, 0, event.target.value)}
              className={`w-28 ${PANEL_FIELD_CLASSNAME}`}
            />
            <select
              value={target}
              aria-label={labels.keywordRoutes}
              onChange={(event) => updateRoute(index, 1, event.target.value)}
              className={`flex-1 ${PANEL_FIELD_CLASSNAME}`}
            >
              <option value="">—</option>
              {renderTargetOptions()}
            </select>
            <button
              type="button"
              data-cv-tooltip={labels.removeKeywordRoute}
              aria-label={labels.removeKeywordRoute}
              onClick={() => removeRoute(index)}
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
