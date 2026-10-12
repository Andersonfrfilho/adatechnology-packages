/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  INFRA_ENVIRONMENT_CLASSIFICATION,
  INFRA_ENVIRONMENT_POWER_STATE,
  INFRA_SERVICE_POWER_STATE,
} from '../constants/infra.constant'
import type { InfraEnvironment, InfraService } from '../types/infra.types'

type ActionEnvironment = Pick<InfraEnvironment, 'classification' | 'state' | 'runningOperationId'>

function isManageableNow(environment: ActionEnvironment): boolean {
  if (environment.classification !== INFRA_ENVIRONMENT_CLASSIFICATION.MANAGED) return false
  if (environment.runningOperationId !== undefined) return false

  return environment.state !== INFRA_ENVIRONMENT_POWER_STATE.TRANSITIONING
}

/** Desligar so faz sentido em ambiente gerenciavel, sem operacao rodando e ainda com algo no ar. */
export function canPowerOff(environment: ActionEnvironment): boolean {
  return isManageableNow(environment) && environment.state !== INFRA_ENVIRONMENT_POWER_STATE.STOPPED
}

/** Ligar so faz sentido em ambiente gerenciavel, sem operacao rodando e ainda com algo parado. */
export function canPowerOn(environment: ActionEnvironment): boolean {
  return isManageableNow(environment) && environment.state !== INFRA_ENVIRONMENT_POWER_STATE.RUNNING
}

/** Exato e sensivel a caixa: confirmar o desligamento e um ato deliberado, nao uma aproximacao. */
export function matchesEnvironmentName({
  typed,
  expected,
}: {
  readonly typed: string
  readonly expected: string
}): boolean {
  return expected.length > 0 && typed === expected
}

/** O que o desligamento vai parar, na ordem em que para: aplicacoes primeiro, bancos por ultimo. */
export function listServicesToStop(services: readonly InfraService[]): readonly InfraService[] {
  const stoppable = services.filter(
    (service) =>
      service.powerState === INFRA_SERVICE_POWER_STATE.RUNNING ||
      service.powerState === INFRA_SERVICE_POWER_STATE.TRANSITIONING,
  )

  return [...stoppable.filter((service) => !service.isDatabase), ...stoppable.filter((service) => service.isDatabase)]
}
