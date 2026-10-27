/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { z } from 'zod'

export const infraEnvironmentParamsSchema = z.object({ environmentId: z.string().uuid() })

export const infraOperationParamsSchema = z.object({ operationId: z.string().uuid() })

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const TIME_OF_DAY_MESSAGE = 'Use o formato HH:mm (00:00 a 23:59)'

export const infraScheduleBodySchema = z.object({
  activeWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
  powerOnTime: z.string().regex(TIME_OF_DAY_PATTERN, TIME_OF_DAY_MESSAGE),
  powerOffTime: z.string().regex(TIME_OF_DAY_PATTERN, TIME_OF_DAY_MESSAGE),
  isEnabled: z.boolean(),
})

/** Ligar ou desligar só alguns serviços do ambiente; ausente = o ambiente inteiro. */
export const infraPowerServiceIdsSchema = z.array(z.string().min(1).max(64)).min(1).max(50)

export const infraPowerOffBodySchema = z.object({
  serviceIds: infraPowerServiceIdsSchema.optional(),
})

export const infraPowerOnBodySchema = z.object({
  keepOnUntil: z.string().datetime({ offset: true }).optional(),
  serviceIds: infraPowerServiceIdsSchema.optional(),
})
