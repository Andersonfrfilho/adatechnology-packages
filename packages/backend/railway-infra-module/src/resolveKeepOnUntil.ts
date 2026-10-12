/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  INFRA_KEEP_ON_UNTIL_MAX_HOURS,
  INFRA_OPERATION_TRIGGER,
  INFRA_POWER_DIRECTION,
  type InfraPowerDirection,
} from '@adatechnology/railway-infra-contracts'
import { InfraKeepOnUntilRequiredError } from '@adatechnology/railway-infra-contracts'
import { isInsideScheduleWindow } from './resolveScheduleAction'
import type { PowerEnvironmentParams } from '@adatechnology/railway-infra-contracts'
import type { InfraScheduleRepositoryInterface } from '@adatechnology/railway-infra-contracts'

const MS_PER_HOUR = 3_600_000

type ResolveKeepOnUntilParams = {
  readonly params: PowerEnvironmentParams
  readonly environmentId: string
  readonly direction: InfraPowerDirection
  readonly scheduleRepository: InfraScheduleRepositoryInterface
  readonly now: () => Date
}

/** `undefined` = nao mexe; `null` = limpa (desligar manual); `Date` = grava (ligar manual fora da janela). */
export async function resolveKeepOnUntil(options: ResolveKeepOnUntilParams): Promise<Date | null | undefined> {
  const { params, environmentId, direction, scheduleRepository } = options
  if (params.trigger !== INFRA_OPERATION_TRIGGER.MANUAL) return undefined
  if (direction === INFRA_POWER_DIRECTION.OFF) return null

  const schedule = await scheduleRepository.findByEnvironmentId(environmentId)
  if (!schedule?.isEnabled) return undefined

  const now = options.now()
  if (isInsideScheduleWindow({ schedule, at: now })) return undefined

  const { keepOnUntil } = params
  if (!keepOnUntil) throw new InfraKeepOnUntilRequiredError()
  if (keepOnUntil <= now) throw new InfraKeepOnUntilRequiredError('O horario para manter ligado deve estar no futuro')

  const limit = new Date(now.getTime() + INFRA_KEEP_ON_UNTIL_MAX_HOURS * MS_PER_HOUR)
  if (keepOnUntil > limit) {
    throw new InfraKeepOnUntilRequiredError(
      `O ambiente pode ficar ligado por no maximo ${INFRA_KEEP_ON_UNTIL_MAX_HOURS} horas`,
    )
  }
  return keepOnUntil
}
