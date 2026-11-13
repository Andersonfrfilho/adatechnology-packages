/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { z } from 'zod'

import { BILLING_INTERVAL_VALUES, PAYMENT_METHOD_VALUES, SUBSCRIPTION_STATUS_VALUES } from './payment.types'

export const moneySchema = z.object({ cents: z.number().int().nonnegative(), currency: z.string().length(3) })

export const planOfferSchema = z.object({
  provider: z.string().min(1),
  offerCode: z.string().min(1),
  checkoutUrl: z.string().url().optional(),
  paymentMethods: z.array(z.enum(PAYMENT_METHOD_VALUES)).optional(),
})

export const planDefinitionSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  interval: z.enum(BILLING_INTERVAL_VALUES),
  price: moneySchema.optional(),
  features: z.array(z.string().min(1)),
  offers: z.array(planOfferSchema),
  isFree: z.boolean().optional(),
})

/** O catálogo inteiro: códigos únicos, exatamente um plano gratuito, oferta não repetida. */
export const planCatalogSchema = z
  .array(planDefinitionSchema)
  .min(1)
  .superRefine((plans, context) => {
    const codes = new Set<string>()
    const offers = new Set<string>()
    for (const plan of plans) {
      if (codes.has(plan.code)) context.addIssue({ code: 'custom', message: `plano repetido: ${plan.code}` })
      codes.add(plan.code)
      for (const offer of plan.offers) {
        const key = `${offer.provider}:${offer.offerCode}`
        if (offers.has(key)) context.addIssue({ code: 'custom', message: `oferta em dois planos: ${key}` })
        offers.add(key)
      }
    }
    const free = plans.filter((plan) => plan.isFree).length
    if (free !== 1)
      context.addIssue({ code: 'custom', message: `o catálogo precisa de exatamente um plano gratuito (tem ${free})` })
  })

export const listSubscriptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(SUBSCRIPTION_STATUS_VALUES).optional(),
  search: z.string().trim().min(1).max(120).optional(),
})
export type ListSubscriptionsQuery = z.infer<typeof listSubscriptionsQuerySchema>

export const listPaymentEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListPaymentEventsQuery = z.infer<typeof listPaymentEventsQuerySchema>

/**
 * Resgate de compra sem dono pelo código da transação do provedor (o que chega no e-mail de
 * confirmação da compra). Só letras, números e hífen: o código vai direto para a consulta.
 */
export const claimPurchaseBodySchema = z.object({
  provider: z.string().trim().min(1).max(40),
  transactionId: z
    .string()
    .trim()
    .min(4)
    .max(80)
    .regex(/^[A-Za-z0-9-]+$/),
})
export type ClaimPurchaseBody = z.infer<typeof claimPurchaseBodySchema>
