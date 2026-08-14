/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Molde de `catalog-module/src/use-cases/catalogModule.types.ts`: repositórios nomeados + config,
 * com `clock`/`logger` opcionais injetáveis. Ports usados só a partir da Fase 4 (vídeo, calendário,
 * hooks de evento) entram no tipo quando o primeiro use-case que precisa deles existir — adicionar
 * agora seria campo sem consumidor.
 */

import type { ClockPort, LoggerPort, SchedulingModuleConfig } from '@adatechnology/scheduling-contracts'

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
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
}

export function nowOf(dependencies: SchedulingDependencies): Date {
  return dependencies.clock ? dependencies.clock.now() : new Date()
}
