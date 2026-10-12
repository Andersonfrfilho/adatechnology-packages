/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  INFRA_OPERATION_KIND,
  INFRA_POWER_DIRECTION,
  type InfraPowerDirection,
} from '@adatechnology/railway-infra-contracts'
import type { InfraOperationLock } from './InfraOperationLock'
import type { InfraOperationRecord, PowerEnvironmentParams } from '@adatechnology/railway-infra-contracts'
import type { InfraOperationRepositoryInterface } from '@adatechnology/railway-infra-contracts'
import type { InfraScheduleRepositoryInterface } from '@adatechnology/railway-infra-contracts'
import type { RailwayProject } from '@adatechnology/railway-infra-contracts'

type RegisterPowerOperationParams = {
  readonly params: PowerEnvironmentParams
  readonly project: RailwayProject
  readonly keepOnUntilChange: Date | null | undefined
  readonly lockOwner: string
  readonly direction: InfraPowerDirection
  readonly lock: InfraOperationLock
  readonly scheduleRepository: InfraScheduleRepositoryInterface
  readonly operationRepository: InfraOperationRepositoryInterface
}

export async function registerPowerOperation(options: RegisterPowerOperationParams): Promise<InfraOperationRecord> {
  const { params, project, keepOnUntilChange, lockOwner, direction, lock } = options
  try {
    if (keepOnUntilChange !== undefined) {
      await options.scheduleRepository.setKeepOnUntil({
        environmentId: params.environmentId,
        keepOnUntil: keepOnUntilChange,
      })
    }
    return await options.operationRepository.create({
      railwayProjectId: project.id,
      railwayEnvironmentId: params.environmentId,
      kind: direction === INFRA_POWER_DIRECTION.OFF ? INFRA_OPERATION_KIND.POWER_OFF : INFRA_OPERATION_KIND.POWER_ON,
      trigger: params.trigger,
      ...(params.actor.agentId ? { actorAgentId: params.actor.agentId } : {}),
    })
  } catch (error) {
    // Cleanup de recurso: sem isto a trava ficaria presa ate o TTL por uma falha do banco.
    await lock.release({ environmentId: params.environmentId, lockOwner })
    throw error
  }
}
