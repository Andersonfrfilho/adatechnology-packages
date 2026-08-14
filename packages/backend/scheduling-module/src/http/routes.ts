/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição da tabela de rotas do módulo. Molde de `catalog-module/src/http/routes.ts` — a
 * rota de sincronização de calendário só entra quando `module.hasCalendarSync` é verdadeiro
 * (T5.5), sem flag separada (`pluggable-module.md` §4).
 */

import type { ModuleRouteTable } from '@adatechnology/module-http'

import type { SchedulingModule } from '../SchedulingModule'
import { buildAvailabilityRoutes } from './availabilityRoutes'
import { buildBookingRoutes } from './bookingRoutes'
import { buildResourceRoutes } from './resourceRoutes'
import { buildServiceRoutes } from './serviceRoutes'

export type CreateSchedulingRoutesParams = {
  readonly module: SchedulingModule
}

export function createSchedulingRoutes(params: CreateSchedulingRoutesParams): ModuleRouteTable {
  return [
    ...buildResourceRoutes(params.module),
    ...buildServiceRoutes(params.module),
    ...buildAvailabilityRoutes(params.module),
    ...buildBookingRoutes(params.module),
  ]
}
