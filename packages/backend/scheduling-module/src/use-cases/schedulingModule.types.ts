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

// Nunca `String(error)`/`.message`: um erro não traduzido (driver, hook do host, provedor externo)
// pode embutir SQL, parâmetros vinculados ou corpo de requisição — inclusive campos de texto livre
// da reserva (`security.md` §1). Só o nome da classe do erro é seguro de logar sem inspecionar caso
// a caso. Compartilhado por todos os use-cases do módulo, não só `runHook`.
export function errorNameOf(error: unknown): string {
  return error instanceof Error ? error.name : typeof error
}

/**
 * Hooks são void-tolerantes (spec `SchedulingHooks`): falha de regra do produto no callback do
 * host nunca pode derrubar a operação de agendamento — loga e segue (molde de `catalog-module`).
 * O booleano de retorno deixa o chamador decidir o que fazer com a falha (ex.: `SweepDueRemindersUseCase`
 * desfazendo a marcação de "enviado" — L-004) sem reintroduzir o `throw` que este helper existe para evitar.
 */
export async function runHook(params: {
  readonly dependencies: Pick<SchedulingDependencies, 'logger'>
  readonly name: string
  readonly run: () => Promise<void> | void
}): Promise<boolean> {
  try {
    await params.run()
    return true
  } catch (error) {
    params.dependencies.logger?.warn('scheduling.hook_failed', { hook: params.name, errorName: errorNameOf(error) })
    return false
  }
}
