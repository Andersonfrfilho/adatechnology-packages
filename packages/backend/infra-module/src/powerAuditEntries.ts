/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_AUDIT_ACTOR_TYPE, INFRA_AUDIT_ACTION, INFRA_AUDIT_TARGET } from '@adatechnology/infra-contracts'
import type { InfraAuditEntry } from '@adatechnology/infra-contracts'
import { INFRA_POWER_DIRECTION, type InfraPowerDirection } from '@adatechnology/infra-contracts'
import {
  InfraEnvironmentNotFoundError,
  InfraEnvironmentProtectedError,
  InfraKeepOnUntilRequiredError,
  InfraOperationInProgressError,
} from '@adatechnology/infra-contracts'
import { isUuid } from './isUuid'
import type { ServiceOutcomeCounts } from './resolveOperationStatus'
import type { PowerEnvironmentParams, PowerOutcomeParams } from '@adatechnology/infra-contracts'

type ActorFields = Pick<InfraAuditEntry, 'actorType' | 'actorId' | 'ipAddress'>

type PowerRequestedParams = {
  readonly params: PowerEnvironmentParams
  readonly direction: InfraPowerDirection
  readonly operationId: string
  readonly projectName: string
  readonly environmentName: string
}

type PowerCompletedParams = {
  readonly outcome: PowerOutcomeParams
  readonly direction: InfraPowerDirection
  readonly counts: ServiceOutcomeCounts
}

type PowerDeniedParams = {
  readonly params: PowerEnvironmentParams
  readonly direction: InfraPowerDirection
  readonly reason: string
}

function buildActorFields(params: Pick<PowerEnvironmentParams, 'actor' | 'ipAddress'>): ActorFields {
  return {
    actorType: params.actor.type,
    ...(params.actor.type === INFRA_AUDIT_ACTOR_TYPE.AGENT && params.actor.agentId
      ? { actorId: params.actor.agentId }
      : {}),
    ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
  }
}

/** Recusas que merecem trilha: tentativa de agir sobre ambiente que o painel não pode (ou não deve) mexer agora. */
export function resolveDenialReason(error: unknown): string | undefined {
  const isDenial =
    error instanceof InfraEnvironmentProtectedError ||
    error instanceof InfraEnvironmentNotFoundError ||
    error instanceof InfraOperationInProgressError ||
    error instanceof InfraKeepOnUntilRequiredError
  return isDenial ? error.code : undefined
}

export function buildPowerRequestedEntry(params: PowerRequestedParams): InfraAuditEntry {
  return {
    ...buildActorFields(params.params),
    action: INFRA_AUDIT_ACTION.INFRA_ENVIRONMENT_POWER_REQUESTED,
    targetType: INFRA_AUDIT_TARGET.INFRA_ENVIRONMENT,
    targetId: params.params.environmentId,
    metadata: {
      operationId: params.operationId,
      direction: params.direction,
      trigger: params.params.trigger,
      projectName: params.projectName,
      environmentName: params.environmentName,
      ...(params.params.serviceIds ? { serviceIds: params.params.serviceIds } : {}),
    },
  }
}

export function buildPowerDeniedEntry(params: PowerDeniedParams): InfraAuditEntry {
  return {
    ...buildActorFields(params.params),
    action: INFRA_AUDIT_ACTION.INFRA_ENVIRONMENT_POWER_DENIED,
    targetType: INFRA_AUDIT_TARGET.INFRA_ENVIRONMENT,
    ...(isUuid(params.params.environmentId) ? { targetId: params.params.environmentId } : {}),
    metadata: { direction: params.direction, trigger: params.params.trigger, reason: params.reason },
  }
}

export function buildPowerCompletedEntry(options: PowerCompletedParams): InfraAuditEntry {
  const { outcome, direction, counts } = options
  const { params, status, serviceResults } = outcome
  return {
    ...buildActorFields(params),
    action:
      direction === INFRA_POWER_DIRECTION.OFF
        ? INFRA_AUDIT_ACTION.INFRA_ENVIRONMENT_POWERED_OFF
        : INFRA_AUDIT_ACTION.INFRA_ENVIRONMENT_POWERED_ON,
    targetType: INFRA_AUDIT_TARGET.INFRA_ENVIRONMENT,
    targetId: params.environmentId,
    metadata: {
      operationId: params.operationId,
      projectName: params.projectName,
      environmentName: params.environmentName,
      trigger: params.trigger,
      status,
      serviceResults,
      counts,
    },
  }
}
