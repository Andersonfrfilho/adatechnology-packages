/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_AUDIT_ACTOR_TYPE, INFRA_AUDIT_ACTION, INFRA_AUDIT_TARGET } from '@adatechnology/infra-contracts'
import type { InfraAuditRecorderInterface } from '@adatechnology/infra-contracts'
import { InfraInvalidScheduleError, InfraNotConfiguredError } from '@adatechnology/infra-contracts'
import { locateManagedEnvironment } from './locateManagedEnvironment'
import { resolveNextScheduledActionView } from './resolveNextScheduledActionView'
import { validateScheduleWindow } from './validateScheduleWindow'
import type { SaveEnvironmentScheduleParams, SaveEnvironmentScheduleResult } from '@adatechnology/infra-contracts'
import type { InfraScheduleRepositoryInterface } from '@adatechnology/infra-contracts'
import type { ResolveGateway } from '@adatechnology/infra-contracts'

export type SaveEnvironmentScheduleDependencies = {
  readonly resolveGateway: ResolveGateway
  readonly scheduleRepository: InfraScheduleRepositoryInterface
  readonly recordAudit: InfraAuditRecorderInterface
  readonly managedPattern: string
  readonly selfEnvironmentId: string
  readonly now?: () => Date
}

/** Salva a agenda de um ambiente gerenciavel; protegido ou inexistente nunca grava nada. */
export class SaveEnvironmentScheduleUseCase {
  constructor(private readonly dependencies: SaveEnvironmentScheduleDependencies) {}

  async execute(params: SaveEnvironmentScheduleParams): Promise<SaveEnvironmentScheduleResult> {
    const { resolveGateway, scheduleRepository, managedPattern, selfEnvironmentId } = this.dependencies
    const gateway = await resolveGateway()
    if (!gateway) throw new InfraNotConfiguredError()

    const issues = validateScheduleWindow(params)
    if (issues.length > 0) throw new InfraInvalidScheduleError(`Agenda invalida: ${issues.join('; ')}`)

    const { project, environment } = await locateManagedEnvironment({
      gateway,
      environmentId: params.environmentId,
      managedPattern,
      selfEnvironmentId,
    })

    const schedule = await scheduleRepository.upsert({
      railwayProjectId: project.id,
      railwayEnvironmentId: environment.id,
      activeWeekdays: params.activeWeekdays,
      powerOnTime: params.powerOnTime,
      powerOffTime: params.powerOffTime,
      isEnabled: params.isEnabled,
      ...(params.actor.agentId ? { updatedByAgentId: params.actor.agentId } : {}),
    })

    await this.recordAudit({ params, projectName: project.name, environmentName: environment.name })

    const now = (this.dependencies.now ?? (() => new Date()))()
    return { schedule, nextScheduledAction: resolveNextScheduledActionView({ schedule, now }) }
  }

  private async recordAudit(params: {
    readonly params: SaveEnvironmentScheduleParams
    readonly projectName: string
    readonly environmentName: string
  }): Promise<void> {
    const { params: saved, projectName, environmentName } = params
    await this.dependencies.recordAudit.execute({
      actorType: saved.actor.type,
      ...(saved.actor.type === INFRA_AUDIT_ACTOR_TYPE.AGENT && saved.actor.agentId
        ? { actorId: saved.actor.agentId }
        : {}),
      action: INFRA_AUDIT_ACTION.INFRA_SCHEDULE_CHANGED,
      targetType: INFRA_AUDIT_TARGET.INFRA_ENVIRONMENT,
      targetId: saved.environmentId,
      ...(saved.ipAddress ? { ipAddress: saved.ipAddress } : {}),
      metadata: {
        projectName,
        environmentName,
        activeWeekdays: saved.activeWeekdays,
        powerOnTime: saved.powerOnTime,
        powerOffTime: saved.powerOffTime,
        isEnabled: saved.isEnabled,
      },
    })
  }
}
