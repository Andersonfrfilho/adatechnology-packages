/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { z } from 'zod'

import { INFRA_COSTS_WINDOW_SOURCE } from '@adatechnology/infra-contracts'

const environmentCostSchema = z.object({
  environmentId: z.string(),
  environmentName: z.string(),
  isProduction: z.boolean(),
  cost: z.number(),
  byMeasurement: z.object({
    CPU_USAGE: z.number(),
    MEMORY_USAGE_GB: z.number(),
    DISK_USAGE_GB: z.number(),
    NETWORK_TX_GB: z.number(),
  }),
})

export const infraCostsResultSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  windowSource: z.enum([INFRA_COSTS_WINDOW_SOURCE.BILLING_CYCLE, INFRA_COSTS_WINDOW_SOURCE.CALENDAR_MONTH]),
  currency: z.literal('USD'),
  totalCost: z.number(),
  officialTotal: z.number().optional(),
  divergencePercent: z.number().optional(),
  isDivergent: z.boolean(),
  projectedTotal: z.number(),
  projectionMethod: z.literal('linear'),
  projects: z.array(
    z.object({
      projectId: z.string(),
      projectName: z.string(),
      cost: z.number(),
      projected: z.number(),
      environments: z.array(environmentCostSchema),
    }),
  ),
  pricingCheckedAt: z.string(),
  pricingSource: z.string(),
  isStale: z.boolean(),
})
