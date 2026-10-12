/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ServiceInstanceNode } from './drivers/railway/railwayGateway.schema'
import type { InfraServiceInstance } from '@adatechnology/infra-contracts'

const EXITED_INSTANCE_STATUS = 'EXITED'

export function normalizeServiceInstance(node: ServiceInstanceNode): InfraServiceInstance {
  const deployment = node.latestDeployment
  const activeDeployments = node.activeDeployments ?? []
  const activeDeployment = activeDeployments[0]
  const instanceStatus = deployment?.instances[0]?.status
  const sourceImage = node.source?.image
  // O deployment ativo e o que de fato roda: o ultimo pode estar em build ou ter falhado.
  // Parado só quando TODO deployment ativo está parado: com dois ativos, um parado não derruba o serviço.
  const isDeploymentStopped =
    activeDeployments.length > 0
      ? activeDeployments.every((candidate) => candidate.deploymentStopped === true)
      : deployment?.deploymentStopped === true

  return {
    serviceId: node.serviceId,
    serviceName: node.serviceName,
    ...(sourceImage ? { sourceImage } : {}),
    ...(deployment ? { latestDeploymentId: deployment.id } : {}),
    ...(activeDeployment ? { activeDeploymentId: activeDeployment.id } : {}),
    ...(activeDeployments.length > 0
      ? { activeDeploymentIds: activeDeployments.map((candidate) => candidate.id) }
      : {}),
    hasDeployment: Boolean(deployment),
    isStopped: isDeploymentStopped || instanceStatus === EXITED_INSTANCE_STATUS,
    ...(instanceStatus ? { instanceStatus } : {}),
  }
}
