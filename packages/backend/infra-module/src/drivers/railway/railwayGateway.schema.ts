/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { z } from 'zod'

export const railwayEnvelopeSchema = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.unknown()).optional(),
})

const connection = <TNode extends z.ZodTypeAny>(node: TNode) => z.object({ edges: z.array(z.object({ node })) })

const latestDeploymentSchema = z.object({
  id: z.string(),
  status: z.string(),
  deploymentStopped: z.boolean().nullish(),
  instances: z.array(z.object({ status: z.string() })),
})

const activeDeploymentSchema = z.object({ id: z.string(), deploymentStopped: z.boolean().nullish() })

const serviceInstanceSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  source: z.object({ image: z.string().nullish(), repo: z.string().nullish() }).nullish(),
  latestDeployment: latestDeploymentSchema.nullish(),
  activeDeployments: z.array(activeDeploymentSchema).nullish(),
})

const environmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  serviceInstances: connection(serviceInstanceSchema),
})

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  environments: connection(environmentSchema),
})

export const environmentServicesResponseSchema = z.object({
  environment: z.object({ serviceInstances: connection(serviceInstanceSchema) }),
})

export const inventoryResponseSchema = z.object({ projects: connection(projectSchema) })

export const workspaceResponseSchema = z.object({ workspace: z.object({ id: z.string() }) })

export const billingCycleResponseSchema = z.object({
  workspace: z.object({
    customer: z.object({
      currentUsage: z.number(),
      billingPeriod: z.object({ start: z.string(), end: z.string() }),
    }),
  }),
})

export const usageResponseSchema = z.object({
  usage: z.array(
    z.object({
      measurement: z.string(),
      value: z.number(),
      tags: z.object({ projectId: z.string(), environmentId: z.string() }),
    }),
  ),
})

export const estimatedUsageResponseSchema = z.object({
  estimatedUsage: z.array(z.object({ measurement: z.string(), estimatedValue: z.number(), projectId: z.string() })),
})

export const deploymentStopResponseSchema = z.object({ deploymentStop: z.boolean() })
export const deploymentRestartResponseSchema = z.object({ deploymentRestart: z.boolean() })
export const serviceInstanceRedeployResponseSchema = z.object({ serviceInstanceRedeploy: z.boolean() })

export type InventoryResponse = z.infer<typeof inventoryResponseSchema>
export type ServiceInstanceNode = z.infer<typeof serviceInstanceSchema>
