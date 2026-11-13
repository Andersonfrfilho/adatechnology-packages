/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState, type ReactNode } from 'react'

import { AgendaArea } from './AgendaArea'
import { AvailabilityArea } from './AvailabilityArea'
import { BookingsArea } from './BookingsArea'
import { DEFAULT_SCHEDULING_WORKSPACE_LABELS, type SchedulingWorkspaceLabels } from './labels'
import { ResourcesArea } from './ResourcesArea'
import { ServicesArea } from './ServicesArea'
import { WorkspaceAreaNav } from './WorkspaceAreaNav'
import { SCHEDULING_WORKSPACE_AREA, type SchedulingWorkspaceArea } from './workspace.constant'

export type SchedulingWorkspaceProps = {
  readonly labels?: Partial<SchedulingWorkspaceLabels>
  /** Ações do produto no cabeçalho (ex: exportar agenda). Ausente, nada é desenhado. */
  readonly renderHeaderActions?: () => ReactNode
  /**
   * Área aberta, controlada pelo host — é assim que ela vai para a query string e sobrevive ao
   * refresh e ao link colado. Sem `onAreaChange` a tela controla a própria área internamente.
   */
  readonly area?: SchedulingWorkspaceArea
  readonly onAreaChange?: (area: SchedulingWorkspaceArea) => void
}

const AREA_COMPONENT = {
  [SCHEDULING_WORKSPACE_AREA.AGENDA]: AgendaArea,
  [SCHEDULING_WORKSPACE_AREA.BOOKINGS]: BookingsArea,
  [SCHEDULING_WORKSPACE_AREA.RESOURCES]: ResourcesArea,
  [SCHEDULING_WORKSPACE_AREA.SERVICES]: ServicesArea,
  [SCHEDULING_WORKSPACE_AREA.AVAILABILITY]: AvailabilityArea,
} as const

export function SchedulingWorkspace({
  labels: labelsOverride,
  renderHeaderActions,
  area: areaProp,
  onAreaChange,
}: SchedulingWorkspaceProps) {
  const labels = { ...DEFAULT_SCHEDULING_WORKSPACE_LABELS, ...labelsOverride }
  const [internalArea, setInternalArea] = useState<SchedulingWorkspaceArea>(SCHEDULING_WORKSPACE_AREA.AGENDA)

  const area = areaProp ?? internalArea
  const AreaComponent = AREA_COMPONENT[area]

  function handleSelectArea(next: SchedulingWorkspaceArea): void {
    setInternalArea(next)
    onAreaChange?.(next)
  }

  return (
    <div className="flex h-full flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-4 pb-2 pt-4">
        <h1 className="mr-auto text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{labels.title}</h1>
        {renderHeaderActions?.()}
      </header>

      <WorkspaceAreaNav area={area} labels={labels} onSelect={handleSelectArea} />

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <AreaComponent />
      </div>
    </div>
  )
}
