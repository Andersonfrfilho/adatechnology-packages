/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { RAILWAY_INFRA_PRICING } from './railwayPricing.constant'
import { INFRA_ACCESS_STATUS, type InfraAccessStatus } from '@adatechnology/infra-contracts'
import { InfraProviderRejectedError, InfraProviderRequestFailedError } from '@adatechnology/infra-contracts'
import { normalizeInventory } from '../../normalizeInventory'
import { normalizeServiceInstance } from '../../normalizeServiceInstance'
import { RailwayGraphqlClient } from './RailwayGraphqlClient'
import {
  BILLING_CYCLE_QUERY,
  ENVIRONMENT_SERVICES_QUERY,
  ESTIMATED_USAGE_QUERY,
  INVENTORY_QUERY,
  RAILWAY_OPERATION,
  REDEPLOY_MUTATION,
  REMOVE_MUTATION,
  RESTART_POLICY_QUERY,
  SET_RESTART_POLICY_MUTATION,
  RESTART_MUTATION,
  STOP_MUTATION,
  USAGE_QUERY,
  WORKSPACE_QUERY,
} from './railwayGateway.documents'
import {
  billingCycleResponseSchema,
  deploymentRemoveResponseSchema,
  deploymentRestartResponseSchema,
  restartPolicyResponseSchema,
  setRestartPolicyResponseSchema,
  deploymentStopResponseSchema,
  environmentServicesResponseSchema,
  estimatedUsageResponseSchema,
  inventoryResponseSchema,
  serviceInstanceRedeployResponseSchema,
  usageResponseSchema,
  workspaceResponseSchema,
} from './railwayGateway.schema'
import type { InfraGatewayInterface } from '@adatechnology/infra-contracts'
import {
  INFRA_RESTART_POLICY_TYPE,
  type InfraRestartPolicy,
  type InfraRestartPolicyType,
  type InfraServiceReference,
  type SetRestartPolicyParams,
} from '@adatechnology/infra-contracts'
import type {
  GetEnvironmentServicesParams,
  GetUsageParams,
  RailwayGatewayDependencies,
} from '@adatechnology/infra-contracts'
import type {
  RedeployServiceParams,
  RemoveDeploymentParams,
  RestartDeploymentParams,
  StopDeploymentParams,
} from '@adatechnology/infra-contracts'
import type { InfraBillingCycle, InfraEstimatedUsageRow, InfraProject } from '@adatechnology/infra-contracts'
import type { InfraServiceInstance, InfraUsageRow } from '@adatechnology/infra-contracts'

/**
 * A borda entre a API GraphQL do Railway e o dominio.
 *
 * Toda resposta e entrada nao confiavel: passa por zod, e `errors` conta como falha mesmo com HTTP 200.
 * O token so vai no header; nunca entra em mensagem, contexto de erro ou log.
 */
// Valor desconhecido do provedor vira ON_FAILURE, o padrão dele: o desligamento só altera o que reconhece.
function toRestartPolicyType(value: string): InfraRestartPolicyType {
  return (Object.values(INFRA_RESTART_POLICY_TYPE) as readonly string[]).includes(value)
    ? (value as InfraRestartPolicyType)
    : INFRA_RESTART_POLICY_TYPE.ON_FAILURE
}

export class RailwayGateway implements InfraGatewayInterface {
  readonly pricing = RAILWAY_INFRA_PRICING
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

  async listInventory(): Promise<readonly InfraProject[]> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.INVENTORY,
      query: INVENTORY_QUERY,
      variables: { workspaceId: this.workspaceId },
      schema: inventoryResponseSchema,
    })

    return normalizeInventory(data)
  }

  async getEnvironmentServices(params: GetEnvironmentServicesParams): Promise<readonly InfraServiceInstance[]> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.ENVIRONMENT_SERVICES,
      query: ENVIRONMENT_SERVICES_QUERY,
      variables: { id: params.environmentId },
      schema: environmentServicesResponseSchema,
    })

    return data.environment.serviceInstances.edges.map(({ node }) => normalizeServiceInstance(node))
  }

  async getRestartPolicy(reference: InfraServiceReference): Promise<InfraRestartPolicy> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.GET_RESTART_POLICY,
      query: RESTART_POLICY_QUERY,
      variables: { environmentId: reference.environmentId, serviceId: reference.serviceId },
      schema: restartPolicyResponseSchema,
    })
    const { restartPolicyType, restartPolicyMaxRetries } = data.serviceInstance

    return {
      type: toRestartPolicyType(restartPolicyType),
      ...(typeof restartPolicyMaxRetries === 'number' ? { maxRetries: restartPolicyMaxRetries } : {}),
    }
  }

  async setRestartPolicy(params: SetRestartPolicyParams): Promise<void> {
    const { environmentId, serviceId, policy } = params
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.SET_RESTART_POLICY,
      query: SET_RESTART_POLICY_MUTATION,
      variables: {
        environmentId,
        serviceId,
        input: {
          restartPolicyType: policy.type,
          ...(policy.maxRetries !== undefined ? { restartPolicyMaxRetries: policy.maxRetries } : {}),
        },
      },
      schema: setRestartPolicyResponseSchema,
    })

    assertAccepted(data.serviceInstanceUpdate, RAILWAY_OPERATION.SET_RESTART_POLICY)
  }

  async removeDeployment(params: RemoveDeploymentParams): Promise<void> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.REMOVE,
      query: REMOVE_MUTATION,
      variables: { id: params.deploymentId },
      schema: deploymentRemoveResponseSchema,
    })

    assertAccepted(data.deploymentRemove, RAILWAY_OPERATION.REMOVE)
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

  async getBillingCycle(): Promise<InfraBillingCycle> {
    const data = await this.client.execute({
      operationName: RAILWAY_OPERATION.BILLING_CYCLE,
      query: BILLING_CYCLE_QUERY,
      variables: { workspaceId: this.workspaceId },
      schema: billingCycleResponseSchema,
    })
    const { currentUsage, billingPeriod } = data.workspace.customer

    return { start: billingPeriod.start, end: billingPeriod.end, currentUsage }
  }

  async getUsage(params: GetUsageParams): Promise<readonly InfraUsageRow[]> {
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

  async getEstimatedUsage(): Promise<readonly InfraEstimatedUsageRow[]> {
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
      return error instanceof InfraProviderRejectedError
        ? INFRA_ACCESS_STATUS.BILLING_UNAVAILABLE
        : INFRA_ACCESS_STATUS.UNAVAILABLE
    }
  }
}

function isAuthFailure(error: unknown): boolean {
  return error instanceof InfraProviderRejectedError && error.isAuthFailure
}

function assertAccepted(isAccepted: boolean, operationName: string): void {
  if (!isAccepted) throw new InfraProviderRequestFailedError(operationName)
}
