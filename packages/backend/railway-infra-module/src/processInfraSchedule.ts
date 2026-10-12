/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_AUDIT_ACTOR_TYPE } from '@adatechnology/railway-infra-contracts'
import {
  INFRA_ENVIRONMENT_POWER_STATE,
  INFRA_OPERATION_TRIGGER,
  INFRA_SCHEDULE_ACTION,
  type InfraEnvironmentPowerState,
} from '@adatechnology/railway-infra-contracts'
import { InfraEnvironmentProtectedError, InfraOperationInProgressError } from '@adatechnology/railway-infra-contracts'
import type { PowerEnvironmentUseCase } from './powerEnvironment.use-case'
import { resolveEnvironmentPowerState } from './resolveEnvironmentPowerState'
import { resolveServiceErrorCode } from './resolveServiceErrorCode'
import { resolveServicePowerState } from './resolveServicePowerState'
import type { InfraLogger } from '@adatechnology/railway-infra-contracts'
import type { InfraScheduleRecord, ResolveScheduleActionResult } from '@adatechnology/railway-infra-contracts'
import type { InfraScheduleRepositoryInterface } from '@adatechnology/railway-infra-contracts'
import type { RailwayEnvironment, RailwayProject } from '@adatechnology/railway-infra-contracts'

export type PowerUseCase = Pick<PowerEnvironmentUseCase, 'execute'>

export type ProcessInfraScheduleDependencies = {
  readonly scheduleRepository: InfraScheduleRepositoryInterface
  readonly powerOnEnvironment: PowerUseCase
  readonly powerOffEnvironment: PowerUseCase
  readonly logger: InfraLogger
}

export type ProcessScheduleParams = {
  readonly schedule: InfraScheduleRecord
  readonly decision: ResolveScheduleActionResult
  readonly inventory: readonly RailwayProject[]
  readonly now: Date
}

type PowerAction = typeof INFRA_SCHEDULE_ACTION.POWER_ON | typeof INFRA_SCHEDULE_ACTION.POWER_OFF

type DispatchParams = {
  readonly environmentId: string
  readonly action: PowerAction
  readonly now: Date
  readonly shouldClearKeepOn: boolean
}

const TARGET_STATE: Readonly<Record<PowerAction, InfraEnvironmentPowerState>> = {
  [INFRA_SCHEDULE_ACTION.POWER_ON]: INFRA_ENVIRONMENT_POWER_STATE.RUNNING,
  [INFRA_SCHEDULE_ACTION.POWER_OFF]: INFRA_ENVIRONMENT_POWER_STATE.STOPPED,
}

function findEnvironment(params: {
  readonly inventory: readonly RailwayProject[]
  readonly environmentId: string
}): RailwayEnvironment | undefined {
  for (const project of params.inventory) {
    const found = project.environments.find((candidate) => candidate.id === params.environmentId)
    if (found) return found
  }
  return undefined
}

/** Avalia UMA agenda contra o inventario: avanca o relogio dela, ignora ou dispara a operacao de energia. */
export class ProcessInfraSchedule {
  constructor(private readonly dependencies: ProcessInfraScheduleDependencies) {}

  async execute(params: ProcessScheduleParams): Promise<void> {
    const { schedule, decision, inventory, now } = params
    const environmentId = schedule.railwayEnvironmentId
    const { action, shouldClearKeepOn } = decision

    if (action === INFRA_SCHEDULE_ACTION.NONE) {
      await this.advance({ environmentId, now, shouldClearKeepOn })
      return
    }

    const environment = findEnvironment({ inventory, environmentId })
    if (!environment) {
      await this.skip({ environmentId, action, now, shouldClearKeepOn, reason: 'environment_not_found' })
      return
    }

    const state = resolveEnvironmentPowerState(environment.services.map(resolveServicePowerState))
    if (state === TARGET_STATE[action]) {
      await this.skip({ environmentId, action, now, shouldClearKeepOn, reason: 'already_in_target_state' })
      return
    }

    await this.dispatch({ environmentId, action, now, shouldClearKeepOn })
  }

  private async dispatch(params: DispatchParams): Promise<void> {
    const { environmentId, action, now, shouldClearKeepOn } = params
    const powerUseCase =
      action === INFRA_SCHEDULE_ACTION.POWER_ON
        ? this.dependencies.powerOnEnvironment
        : this.dependencies.powerOffEnvironment

    try {
      await powerUseCase.execute({
        environmentId,
        actor: { type: INFRA_AUDIT_ACTOR_TYPE.SYSTEM },
        trigger: INFRA_OPERATION_TRIGGER.SCHEDULE,
      })
    } catch (error) {
      await this.handleDispatchFailure({ error, ...params })
      return
    }

    this.dependencies.logger.info('Agenda de infra disparou a operacao', { environmentId, action })
    await this.dependencies.scheduleRepository.recordEvaluation({
      environmentId,
      lastEvaluatedAt: now,
      ...(action === INFRA_SCHEDULE_ACTION.POWER_ON ? { lastPowerOnAt: now } : { lastPowerOffAt: now }),
      ...(shouldClearKeepOn ? { keepOnUntil: null } : {}),
    })
  }

  // Protegido avanca para nunca insistir; trava ocupada e erro externo nao avancam, e o proximo minuto retenta.
  private async handleDispatchFailure(params: DispatchParams & { readonly error: unknown }): Promise<void> {
    const { error, ...dispatch } = params
    if (error instanceof InfraEnvironmentProtectedError) {
      await this.skip({ ...dispatch, reason: 'environment_protected' })
      return
    }
    if (error instanceof InfraOperationInProgressError) {
      this.dependencies.logger.info('Agenda de infra adiada: operacao em andamento', {
        environmentId: dispatch.environmentId,
        action: dispatch.action,
      })
      return
    }
    this.dependencies.logger.error('Agenda de infra falhou ao disparar a operacao', {
      environmentId: dispatch.environmentId,
      action: dispatch.action,
      errorCode: resolveServiceErrorCode(error),
    })
  }

  private async skip(params: DispatchParams & { readonly reason: string }): Promise<void> {
    this.dependencies.logger.info('Agenda de infra ignorou a acao', {
      environmentId: params.environmentId,
      action: params.action,
      reason: params.reason,
    })
    await this.advance(params)
  }

  private async advance(params: {
    readonly environmentId: string
    readonly now: Date
    readonly shouldClearKeepOn: boolean
  }): Promise<void> {
    await this.dependencies.scheduleRepository.recordEvaluation({
      environmentId: params.environmentId,
      lastEvaluatedAt: params.now,
      ...(params.shouldClearKeepOn ? { keepOnUntil: null } : {}),
    })
  }
}
