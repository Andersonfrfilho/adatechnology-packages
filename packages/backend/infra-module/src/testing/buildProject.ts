/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraProject, InfraServiceInstance } from '@adatechnology/infra-contracts'

export function buildProject(params: {
  readonly environmentId: string
  readonly environmentName: string
  readonly services: readonly InfraServiceInstance[]
}): InfraProject {
  return {
    id: 'project-1',
    name: 'ada',
    environments: [{ id: params.environmentId, name: params.environmentName, services: params.services }],
  }
}
