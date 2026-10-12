/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { RailwayServiceInstance } from '@adatechnology/railway-infra-contracts'

export type ServiceShape = 'running' | 'stopped' | 'none'

export function buildService(params: {
  readonly name: string
  readonly shape?: ServiceShape
  readonly image?: string
}): RailwayServiceInstance {
  const shape = params.shape ?? 'running'
  return {
    serviceId: `svc-${params.name}`,
    serviceName: params.name,
    ...(params.image ? { sourceImage: params.image } : {}),
    ...(shape === 'none' ? {} : { latestDeploymentId: `dep-${params.name}` }),
    hasDeployment: shape !== 'none',
    isStopped: shape === 'stopped',
    ...(shape === 'none' ? {} : { instanceStatus: shape === 'running' ? 'RUNNING' : 'EXITED' }),
  }
}
