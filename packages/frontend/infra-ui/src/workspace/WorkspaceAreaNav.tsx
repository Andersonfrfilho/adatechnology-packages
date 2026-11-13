/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_WORKSPACE_AREA, type InfraWorkspaceArea } from './workspace.constant'
import type { InfraWorkspaceLabels } from './labels'

export type WorkspaceAreaNavProps = {
  readonly area: InfraWorkspaceArea
  readonly areas: readonly InfraWorkspaceArea[]
  readonly labels: InfraWorkspaceLabels
  readonly onSelect: (area: InfraWorkspaceArea) => void
}

const ITEM_BASE =
  'flex items-center gap-2 px-3 py-2 -mb-px border-b-2 text-sm font-medium transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500'
const ITEM_ACTIVE = 'border-brand-600 text-brand-700 dark:text-brand-400'
const ITEM_IDLE = 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'

function resolveAreaLabel(area: InfraWorkspaceArea, labels: InfraWorkspaceLabels): string {
  if (area === INFRA_WORKSPACE_AREA.ENVIRONMENTS) return labels.environmentsTab
  if (area === INFRA_WORKSPACE_AREA.COSTS) return labels.costsTab
  return labels.integrationTab
}

export function WorkspaceAreaNav({ area, areas, labels, onSelect }: WorkspaceAreaNavProps) {
  return (
    <nav
      aria-label={labels.areaNav}
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 px-4 dark:border-gray-800"
    >
      {areas.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          aria-current={value === area ? 'page' : undefined}
          className={`${ITEM_BASE} ${value === area ? ITEM_ACTIVE : ITEM_IDLE} whitespace-nowrap`}
        >
          {resolveAreaLabel(value, labels)}
        </button>
      ))}
    </nav>
  )
}
