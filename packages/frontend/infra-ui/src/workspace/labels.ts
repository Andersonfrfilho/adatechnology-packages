/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Vocabulário da moldura do workspace — título e nome das abas. Texto interno de cada área vem de
 * `src/locales`.
 */

export type InfraWorkspaceLabels = {
  readonly title: string
  readonly areaNav: string
  readonly environmentsTab: string
  readonly costsTab: string
  readonly integrationTab: string
}

export const DEFAULT_INFRA_WORKSPACE_LABELS: InfraWorkspaceLabels = {
  title: 'Infraestrutura',
  areaNav: 'Áreas da infraestrutura',
  environmentsTab: 'Ambientes',
  costsTab: 'Custos',
  integrationTab: 'Integração',
}
