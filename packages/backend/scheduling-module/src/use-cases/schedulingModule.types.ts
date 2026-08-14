/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Molde de `catalog-module/src/use-cases/catalogModule.types.ts`: repositórios nomeados + config,
 * com `clock`/`logger` opcionais injetáveis. A partir da Fase 4, os use-cases de reserva também
 * recebem `hooks` (eventos de domínio) e os ports opcionais de vídeo/calendário.
 */

import type {
  ClockPort,
  LoggerPort,
  SchedulingHooks,
  SchedulingModuleConfig,
  CalendarSyncPort,
  VideoMeetingPort,
} from '@adatechnology/scheduling-contracts'

import type { AvailabilityRepository } from '../repositories/AvailabilityRepository'
import type { BookingRepository } from '../repositories/BookingRepository'
import type { ResourceRepository } from '../repositories/ResourceRepository'
import type { ServiceRepository } from '../repositories/ServiceRepository'

export type SchedulingRepositories = {
  readonly resources: ResourceRepository
  readonly services: ServiceRepository
  readonly availability: AvailabilityRepository
  readonly bookings: BookingRepository
}

export type SchedulingDependencies = {
  readonly repositories: SchedulingRepositories
  readonly config: SchedulingModuleConfig
  readonly hooks?: SchedulingHooks
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
  readonly videoMeeting?: VideoMeetingPort
  readonly calendarSync?: CalendarSyncPort
}

export function nowOf(dependencies: SchedulingDependencies): Date {
  return dependencies.clock ? dependencies.clock.now() : new Date()
}

/**
 * Hooks são void-tolerantes (spec `SchedulingHooks`): falha de regra do produto no callback do
 * host nunca pode derrubar a operação de agendamento — loga e segue (molde de `catalog-module`).
 */
export async function runHook(params: {
  readonly dependencies: Pick<SchedulingDependencies, 'logger'>
  readonly name: string
  readonly run: () => Promise<void> | void
}): Promise<void> {
  try {
    await params.run()
  } catch (error) {
    params.dependencies.logger?.warn('scheduling.hook_failed', { hook: params.name, error: String(error) })
  }
}
