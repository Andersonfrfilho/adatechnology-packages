/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { z } from 'zod'

const serviceSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  sourceImage: z.string().optional(),
  latestDeploymentId: z.string().optional(),
  activeDeploymentId: z.string().optional(),
  hasDeployment: z.boolean(),
  isStopped: z.boolean(),
  instanceStatus: z.string().optional(),
})

export const infraInventoryCacheSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    environments: z.array(z.object({ id: z.string(), name: z.string(), services: z.array(serviceSchema) })),
  }),
)
