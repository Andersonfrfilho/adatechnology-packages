/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Vocabulário da moldura do workspace — título e nome das abas. Tudo sobrescrevível via prop
 * `labels`, sem manter cópia da tela (T7.2). Texto interno de cada área vem de `src/locales`.
 */

export interface SchedulingWorkspaceLabels {
  readonly title: string
  readonly areaNav: string
  readonly agendaTab: string
  readonly bookingsTab: string
  readonly resourcesTab: string
  readonly servicesTab: string
  readonly availabilityTab: string
}

export const DEFAULT_SCHEDULING_WORKSPACE_LABELS: SchedulingWorkspaceLabels = {
  title: 'Agendamento',
  areaNav: 'Áreas do agendamento',
  agendaTab: 'Agenda',
  bookingsTab: 'Reservas',
  resourcesTab: 'Recursos',
  servicesTab: 'Serviços',
  availabilityTab: 'Disponibilidade',
}
