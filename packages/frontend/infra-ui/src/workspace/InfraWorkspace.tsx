/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState, type ReactNode } from 'react'

import { useInfraCapabilities, type InfraCapabilities, type InfraTokenSource } from '../providers'
import { CostsArea } from './CostsArea'
import { EnvironmentsArea } from './EnvironmentsArea'
import { IntegrationArea } from './IntegrationArea'
import { DEFAULT_INFRA_WORKSPACE_LABELS, type InfraWorkspaceLabels } from './labels'
import { WorkspaceAreaNav } from './WorkspaceAreaNav'
import { INFRA_WORKSPACE_AREA, type InfraWorkspaceArea } from './workspace.constant'

export type InfraWorkspaceProps = {
  readonly labels?: Partial<InfraWorkspaceLabels>
  /** Onde o operador gera o token no provedor. Ausente, o link não é desenhado. */
  readonly tokenSource?: InfraTokenSource
  /** Ações do produto no cabeçalho. Ausente, nada é desenhado. */
  readonly renderHeaderActions?: () => ReactNode
  /** Conteúdo do produto acima da área aberta (ex: aviso de manutenção). Ausente, nada é desenhado. */
  readonly renderAboveArea?: (area: InfraWorkspaceArea) => ReactNode
  /**
   * Área aberta, controlada pelo host — é assim que ela vai para a query string e sobrevive ao
   * refresh. Sem `onAreaChange` a tela controla a própria área internamente.
   */
  readonly area?: InfraWorkspaceArea
  readonly onAreaChange?: (area: InfraWorkspaceArea) => void
}

export function resolveAvailableAreas(capabilities: InfraCapabilities): readonly InfraWorkspaceArea[] {
  const areas: InfraWorkspaceArea[] = []
  if (capabilities.hasEnvironments) areas.push(INFRA_WORKSPACE_AREA.ENVIRONMENTS)
  if (capabilities.hasCosts) areas.push(INFRA_WORKSPACE_AREA.COSTS)
  if (capabilities.hasIntegration) areas.push(INFRA_WORKSPACE_AREA.INTEGRATION)
  return areas
}

export function InfraWorkspace({
  labels: labelsOverride,
  tokenSource,
  renderHeaderActions,
  renderAboveArea,
  area: areaProp,
  onAreaChange,
}: InfraWorkspaceProps) {
  const labels = { ...DEFAULT_INFRA_WORKSPACE_LABELS, ...labelsOverride }
  const areas = resolveAvailableAreas(useInfraCapabilities())
  const [internalArea, setInternalArea] = useState<InfraWorkspaceArea | undefined>(undefined)

  const requestedArea = areaProp ?? internalArea
  const area = requestedArea !== undefined && areas.includes(requestedArea) ? requestedArea : areas[0]

  function handleSelectArea(next: InfraWorkspaceArea): void {
    setInternalArea(next)
    onAreaChange?.(next)
  }

  return (
    <div className="flex h-full flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-4 pb-2 pt-4">
        <h1 className="mr-auto text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {labels.title}
        </h1>
        {renderHeaderActions?.()}
      </header>

      {area !== undefined ? (
        <>
          <WorkspaceAreaNav area={area} areas={areas} labels={labels} onSelect={handleSelectArea} />
          {renderAboveArea?.(area)}
          <div className="relative flex flex-1 min-h-0 overflow-hidden">
            {area === INFRA_WORKSPACE_AREA.ENVIRONMENTS ? <EnvironmentsArea /> : null}
            {area === INFRA_WORKSPACE_AREA.COSTS ? <CostsArea /> : null}
            {area === INFRA_WORKSPACE_AREA.INTEGRATION ? <IntegrationArea tokenSource={tokenSource} /> : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
