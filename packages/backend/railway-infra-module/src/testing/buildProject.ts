/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { RailwayProject, RailwayServiceInstance } from '@adatechnology/railway-infra-contracts'

export function buildProject(params: {
  readonly environmentId: string
  readonly environmentName: string
  readonly services: readonly RailwayServiceInstance[]
}): RailwayProject {
  return {
    id: 'project-1',
    name: 'ada',
    environments: [{ id: params.environmentId, name: params.environmentName, services: params.services }],
  }
}
