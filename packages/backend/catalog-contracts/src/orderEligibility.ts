/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Quem pode pedir um produto. Guardado em `attributes.orderEligibility` (jsonb já existente), então
 * não há migration; o módulo não interpreta — quem aplica a regra é o host na hora do pedido.
 */

import { z } from 'zod'

export const PRODUCT_ORDER_ELIGIBILITY_KEY = 'orderEligibility'

export const ORDER_AUDIENCE = {
  EVERYONE: 'everyone',
  STAYING_GUESTS: 'staying_guests',
} as const
export type OrderAudience = (typeof ORDER_AUDIENCE)[keyof typeof ORDER_AUDIENCE]

export const MIN_ORDER_AGE = 0
export const MAX_ORDER_AGE = 21

export type ProductOrderEligibility = {
  /** Idade mínima em anos completos. Ausente/`null` = sem restrição. */
  readonly minimumAge?: number | null
  /** Ausente = `everyone`. */
  readonly audience?: OrderAudience
}

export const productOrderEligibilitySchema = z
  .object({
    minimumAge: z.number().int().min(MIN_ORDER_AGE).max(MAX_ORDER_AGE).nullable().optional(),
    audience: z.enum([ORDER_AUDIENCE.EVERYONE, ORDER_AUDIENCE.STAYING_GUESTS]).optional(),
  })
  .strict()
