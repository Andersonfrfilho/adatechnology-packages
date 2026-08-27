/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CalendarDays, Clock, ClipboardList, Users, Wrench } from 'lucide-react'

import { SCHEDULING_WORKSPACE_AREA, type SchedulingWorkspaceArea } from './workspace.constant'
import type { SchedulingWorkspaceLabels } from './labels'

export type WorkspaceAreaNavProps = {
  readonly area: SchedulingWorkspaceArea
  readonly labels: SchedulingWorkspaceLabels
  readonly onSelect: (area: SchedulingWorkspaceArea) => void
}

const ITEM_BASE =
  'flex items-center gap-2 px-3 py-2 -mb-px border-b-2 text-sm font-medium transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500'
const ITEM_ACTIVE = 'border-brand-600 text-brand-700 dark:text-brand-300'
const ITEM_IDLE =
  'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'

const AREA_ICON = {
  [SCHEDULING_WORKSPACE_AREA.AGENDA]: CalendarDays,
  [SCHEDULING_WORKSPACE_AREA.BOOKINGS]: ClipboardList,
  [SCHEDULING_WORKSPACE_AREA.RESOURCES]: Users,
  [SCHEDULING_WORKSPACE_AREA.SERVICES]: Wrench,
  [SCHEDULING_WORKSPACE_AREA.AVAILABILITY]: Clock,
} as const

export function WorkspaceAreaNav({ area, labels, onSelect }: WorkspaceAreaNavProps) {
  const items = [
    [SCHEDULING_WORKSPACE_AREA.AGENDA, labels.agendaTab],
    [SCHEDULING_WORKSPACE_AREA.BOOKINGS, labels.bookingsTab],
    [SCHEDULING_WORKSPACE_AREA.RESOURCES, labels.resourcesTab],
    [SCHEDULING_WORKSPACE_AREA.SERVICES, labels.servicesTab],
    [SCHEDULING_WORKSPACE_AREA.AVAILABILITY, labels.availabilityTab],
  ] as const

  return (
    <nav aria-label={labels.areaNav} className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 px-4 dark:border-gray-800">
      {items.map(([value, label]) => {
        const Icon = AREA_ICON[value]

        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            aria-current={value === area ? 'page' : undefined}
            className={`${ITEM_BASE} ${value === area ? ITEM_ACTIVE : ITEM_IDLE} whitespace-nowrap`}
          >
            <Icon aria-hidden="true" className="w-4 h-4 shrink-0" />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
