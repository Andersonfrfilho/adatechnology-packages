/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Três áreas, e não uma lista só: ambientes, custos e integração têm frequência de uso e
 * público diferentes — a integração, por exemplo, só o administrador abre.
 */
export const INFRA_WORKSPACE_AREA = {
  ENVIRONMENTS: 'environments',
  COSTS: 'costs',
  INTEGRATION: 'integration',
} as const

export type InfraWorkspaceArea = (typeof INFRA_WORKSPACE_AREA)[keyof typeof INFRA_WORKSPACE_AREA]

const AREAS: readonly string[] = Object.values(INFRA_WORKSPACE_AREA)

export function isInfraWorkspaceArea(value: string): value is InfraWorkspaceArea {
  return AREAS.includes(value)
}
