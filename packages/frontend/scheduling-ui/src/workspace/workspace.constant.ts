/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Cinco áreas, e não uma lista só: agenda, reservas, recursos, serviços e disponibilidade têm
 * colunas, filtros e frequência de uso diferentes (spec §T7.2) — empilhar tudo numa tela esconderia
 * a maioria atrás de scroll.
 */
export const SCHEDULING_WORKSPACE_AREA = {
  AGENDA: 'agenda',
  BOOKINGS: 'bookings',
  RESOURCES: 'resources',
  SERVICES: 'services',
  AVAILABILITY: 'availability',
} as const

export type SchedulingWorkspaceArea = (typeof SCHEDULING_WORKSPACE_AREA)[keyof typeof SCHEDULING_WORKSPACE_AREA]

const AREAS: readonly string[] = Object.values(SCHEDULING_WORKSPACE_AREA)

export function isSchedulingWorkspaceArea(value: string): value is SchedulingWorkspaceArea {
  return AREAS.includes(value)
}
