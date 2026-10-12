/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { normalizeServiceInstance } from './normalizeServiceInstance'
import type { InventoryResponse } from './railwayGateway.schema'
import type { RailwayProject } from '@adatechnology/railway-infra-contracts'

export function normalizeInventory(data: InventoryResponse): RailwayProject[] {
  return data.projects.edges.map(({ node: project }) => ({
    id: project.id,
    name: project.name,
    environments: project.environments.edges.map(({ node: environment }) => ({
      id: environment.id,
      name: environment.name,
      services: environment.serviceInstances.edges.map(({ node }) => normalizeServiceInstance(node)),
    })),
  }))
}
