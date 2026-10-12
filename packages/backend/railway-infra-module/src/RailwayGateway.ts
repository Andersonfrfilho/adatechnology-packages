/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_ACCESS_STATUS, type InfraAccessStatus } from '@adatechnology/railway-infra-contracts'
import { RailwayRejectedError, RailwayRequestFailedError } from '@adatechnology/railway-infra-contracts'
import { normalizeInventory } from './normalizeInventory'
import { normalizeServiceInstance } from './normalizeServiceInstance'
import { RailwayGraphqlClient } from './RailwayGraphqlClient'
import {
  BILLING_CYCLE_QUERY,
  ENVIRONMENT_SERVICES_QUERY,
  ESTIMATED_USAGE_QUERY,
  INVENTORY_QUERY,
  RAILWAY_OPERATION,
  REDEPLOY_MUTATION,
  RESTART_MUTATION,
  STOP_MUTATION,
  USAGE_QUERY,
  WORKSPACE_QUERY,
} from './railwayGateway.documents'
import {
  billingCycleResponseSchema,
  deploymentRestartResponseSchema,
  deploymentStopResponseSchema,
  environmentServicesResponseSchema,
  estimatedUsageResponseSchema,
  inventoryResponseSchema,
  serviceInstanceRedeployResponseSchema,
  usageResponseSchema,
  workspaceResponseSchema,
} from './railwayGateway.schema'
import type { RailwayGatewayInterface } from '@adatechnology/railway-infra-contracts'
import type {
  GetEnvironmentServicesParams,
  GetUsageParams,
  RailwayGatewayDependencies,
} from '@adatechnology/railway-infra-contracts'
import type {
  RedeployServiceParams,
  RestartDeploymentParams,
  StopDeploymentParams,
} from '@adatechnology/railway-infra-contracts'
import type {
  RailwayBillingCycle,
  RailwayEstimatedUsageRow,
  RailwayProject,
} from '@adatechnology/railway-infra-contracts'
import type { RailwayServiceInstance, RailwayUsageRow } from '@adatechnology/railway-infra-contracts'

/**
 * A borda entre a API GraphQL do Railway e o dominio.
 *
 * Toda resposta e entrada nao confiavel: passa por zod, e `errors` conta como falha mesmo com HTTP 200.
 * O token so vai no header; nunca entra em mensagem, contexto de erro ou log.
 */
export class RailwayGateway implements RailwayGatewayInterface {
  private readonly client: RailwayGraphqlClient
  private readonly workspaceId: string

  // O token entra so no cliente (campo `#`): guardar `dependencies` inteiro deixaria o token enumeravel aqui.
  constructor({ token, workspaceId, fetchImplementation, now }: RailwayGatewayDependencies) {
    this.workspaceId = workspaceId
    this.client = new RailwayGraphqlClient({
      token,
      fetchImplementation: fetchImplementation ?? fetch,
      now: now ?? Date.now,
    })
  }

  async listInventory(): Promise<readonly RailwayProject[]> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.INVENTORY,
      query: INVENTORY_QUERY,
      variables: { workspaceId: this.workspaceId },
      schema: inventoryResponseSchema,
    })

    return normalizeInventory(data)
  }

  async getEnvironmentServices(params: GetEnvironmentServicesParams): Promise<readonly RailwayServiceInstance[]> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.ENVIRONMENT_SERVICES,
      query: ENVIRONMENT_SERVICES_QUERY,
      variables: { id: params.environmentId },
      schema: environmentServicesResponseSchema,
    })

    return data.environment.serviceInstances.edges.map(({ node }) => normalizeServiceInstance(node))
  }

  async stopDeployment(params: StopDeploymentParams): Promise<void> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.STOP,
      query: STOP_MUTATION,
      variables: { id: params.deploymentId },
      schema: deploymentStopResponseSchema,
    })

    assertAccepted(data.deploymentStop, RAILWAY_OPERATION.STOP)
  }

  async restartDeployment(params: RestartDeploymentParams): Promise<void> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.RESTART,
      query: RESTART_MUTATION,
      variables: { id: params.deploymentId },
      schema: deploymentRestartResponseSchema,
    })

    assertAccepted(data.deploymentRestart, RAILWAY_OPERATION.RESTART)
  }

  async redeployService(params: RedeployServiceParams): Promise<void> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.REDEPLOY,
      query: REDEPLOY_MUTATION,
      variables: { environmentId: params.environmentId, serviceId: params.serviceId },
      schema: serviceInstanceRedeployResponseSchema,
    })

    assertAccepted(data.serviceInstanceRedeploy, RAILWAY_OPERATION.REDEPLOY)
  }

  async getBillingCycle(): Promise<RailwayBillingCycle> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.BILLING_CYCLE,
      query: BILLING_CYCLE_QUERY,
      variables: { workspaceId: this.workspaceId },
      schema: billingCycleResponseSchema,
    })
    const { currentUsage, billingPeriod } = data.workspace.customer

    return { start: billingPeriod.start, end: billingPeriod.end, currentUsage }
  }

  async getUsage(params: GetUsageParams): Promise<readonly RailwayUsageRow[]> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.USAGE,
      query: USAGE_QUERY,
      variables: {
        workspaceId: this.workspaceId,
        startDate: params.startDate,
        endDate: params.endDate,
      },
      schema: usageResponseSchema,
    })

    return data.usage.map((row) => ({
      measurement: row.measurement,
      value: row.value,
      projectId: row.tags.projectId,
      environmentId: row.tags.environmentId,
    }))
  }

  async getEstimatedUsage(): Promise<readonly RailwayEstimatedUsageRow[]> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.ESTIMATED_USAGE,
      query: ESTIMATED_USAGE_QUERY,
      variables: { workspaceId: this.workspaceId },
      schema: estimatedUsageResponseSchema,
    })

    return data.estimatedUsage
  }

  async verifyAccess(): Promise<InfraAccessStatus> {
    try {
      await this.client.execute({
        operationName: RAILWAY_OPERATION.VERIFY_WORKSPACE,
        query: WORKSPACE_QUERY,
        variables: { workspaceId: this.workspaceId },
        schema: workspaceResponseSchema,
      })
    } catch (error) {
      return isAuthFailure(error) ? INFRA_ACCESS_STATUS.TOKEN_INVALID : INFRA_ACCESS_STATUS.UNAVAILABLE
    }

    try {
      await this.getBillingCycle()
      return INFRA_ACCESS_STATUS.OK
    } catch (error) {
      // So uma recusa do Railway indica falta de permissao de cobranca; o resto e instabilidade.
      return error instanceof RailwayRejectedError
        ? INFRA_ACCESS_STATUS.BILLING_UNAVAILABLE
        : INFRA_ACCESS_STATUS.UNAVAILABLE
    }
  }
}

function isAuthFailure(error: unknown): boolean {
  return error instanceof RailwayRejectedError && error.isAuthFailure
}

function assertAccepted(isAccepted: boolean, operationName: string): void {
  if (!isAccepted) throw new RailwayRequestFailedError(operationName)
}
