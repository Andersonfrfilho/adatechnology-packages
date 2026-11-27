/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas chamadas pelo backend do host (checkout, reserva): só ele tem a identidade confiável do
 * cliente e o pedido. O navegador nunca resgata direto.
 */

import {
  DEFAULT_SERVICE_SCOPES,
  findAutomaticSchema,
  redeemCouponSchema,
  releaseRedemptionSchema,
  validateCouponSchema,
  type CartItem,
  type OrderRef,
} from '@adatechnology/coupon-contracts'
import type { ModuleRoute } from '@adatechnology/module-http'

import type { CouponModule } from '../CouponModule'
import { json, requireCompany } from './requireCompany'

type CartBody = { items: CartItem[]; customerRef?: string; at?: string }

export function buildServiceRoutes(module: CouponModule): ModuleRoute[] {
  const { useCases } = module
  const service = { scope: 'service' as const, requiredScopes: module.config.serviceScopes ?? DEFAULT_SERVICE_SCOPES }

  return [
    {
      ...service,
      method: 'POST',
      path: '/coupons/validate',
      bodySchema: validateCouponSchema,
      operationId: 'validateCoupon',
      summary: 'Prévia do desconto de um código para o carrinho; devolve todos os motivos quando não vale',
      async handler(context) {
        const body = context.body as CartBody & { code: string }
        const result = await useCases.validateCoupon.execute({
          companyId: requireCompany(context),
          code: body.code,
          items: body.items,
          customerRef: body.customerRef,
          at: body.at ? new Date(body.at) : undefined,
        })
        return json(200, result)
      },
    },
    {
      ...service,
      method: 'POST',
      path: '/coupons/automatic',
      bodySchema: findAutomaticSchema,
      operationId: 'findAutomaticDiscount',
      summary: 'A campanha automática de maior desconto para o carrinho, ou `null`',
      async handler(context) {
        const body = context.body as CartBody
        const result = await useCases.findAutomatic.execute({
          companyId: requireCompany(context),
          items: body.items,
          customerRef: body.customerRef,
          at: body.at ? new Date(body.at) : undefined,
        })
        return json(200, result ?? null)
      },
    },
    {
      ...service,
      method: 'POST',
      path: '/redemptions',
      bodySchema: redeemCouponSchema,
      operationId: 'redeemCoupon',
      summary: 'Resgata (idempotente por pedido): 201 no primeiro, 200 ao repetir; 422 com os motivos',
      async handler(context) {
        const body = context.body as CartBody & { code?: string; campaignId?: string; orderRef: OrderRef }
        const result = await useCases.redeemCoupon.execute({ ...body, companyId: requireCompany(context) })
        return json(result.isNew ? 201 : 200, result.redemption)
      },
    },
    {
      ...service,
      method: 'POST',
      path: '/redemptions/release',
      bodySchema: releaseRedemptionSchema,
      operationId: 'releaseRedemption',
      summary: 'Devolve o uso do pedido (cancelado); repetir ou pedido sem resgate não é erro',
      async handler(context) {
        const { orderRef } = context.body as { orderRef: OrderRef }
        return json(
          200,
          (await useCases.releaseRedemption.execute({ companyId: requireCompany(context), orderRef })) ?? null,
        )
      },
    },
  ]
}
