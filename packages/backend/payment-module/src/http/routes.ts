/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tabela de rotas. O host monta com o adaptador do `module-http` (`/fetch` ou `/uws`) em poucas
 * linhas, e cada produto deixa de reescrever webhook, plano e painel de assinantes.
 *
 * - A pessoa é SEMPRE `auth.userId`, nunca um id do corpo (BOLA).
 * - O webhook é público: quem autentica é o provedor, pelo segredo dele, dentro do plugin.
 * - Painel com escopo próprio (`payments:read`): ver quem paga é dado financeiro.
 */

import { z } from 'zod'

import {
  claimPurchaseBodySchema,
  listPaymentEventsQuerySchema,
  listSubscriptionsQuerySchema,
} from '@adatechnology/payment-contracts'
import { ROUTE_SCOPE } from '@adatechnology/module-http'
import type { ModuleRoute, ModuleRouteTable, RequestContext } from '@adatechnology/module-http'

import type { CustomerIdentity, PaymentModule } from '../PaymentModule'

export const PAYMENT_SCOPE = {
  /** Ver assinantes, eventos e receita no painel. */
  READ: 'payments:read',
} as const

/** Corpo de webhook maior que isto não é de provedor de pagamento: recusa antes de ler. */
export const PAYMENT_WEBHOOK_MAX_BYTES = 256 * 1024

class PaymentRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export type CreatePaymentRoutesParams = {
  readonly module: PaymentModule
  /** Prefixo das rotas dentro do `basePath` do host. Padrão: `/payments`. */
  readonly prefix?: string
  /**
   * E-mail e nome da pessoa logada, para preencher o checkout. Só o host sabe (o `AuthContext` não
   * carrega e-mail). `verifiedEmail` só quando o host confirmou o e-mail: ele amarra compra feita
   * antes da conta.
   */
  readonly identify?: (
    context: RequestContext,
  ) => Promise<Omit<CustomerIdentity, 'customerRef'>> | Omit<CustomerIdentity, 'customerRef'>
  /** Grupos publicados. Produto sem painel deixa `admin: false`. */
  readonly features?: { readonly webhooks?: boolean; readonly customer?: boolean; readonly admin?: boolean }
}

const json = (body: unknown, status = 200) => ({ kind: 'json' as const, status, body })

export function createPaymentRoutes(params: CreatePaymentRoutesParams): ModuleRouteTable {
  const { module } = params
  const prefix = params.prefix ?? '/payments'
  const features = { webhooks: true, customer: true, admin: true, ...params.features }

  async function identityOf(context: RequestContext): Promise<CustomerIdentity> {
    const customerRef = context.auth?.userId
    if (!customerRef) throw new PaymentRequestError(401, 'UNAUTHENTICATED', 'Sessão necessária.')
    const extra = params.identify ? await params.identify(context) : {}
    return { ...extra, customerRef }
  }

  const webhookRoutes: ModuleRoute[] = [
    {
      method: 'POST',
      path: `${prefix}/webhooks/:provider`,
      scope: ROUTE_SCOPE.PUBLIC,
      operationId: 'receivePaymentWebhook',
      summary: 'Webhook do provedor de pagamento: compra, renovação, atraso, cancelamento, reembolso e troca de plano',
      async handler(context) {
        const rawBody = context.rawBody ?? new Uint8Array()
        if (rawBody.length > PAYMENT_WEBHOOK_MAX_BYTES) {
          throw new PaymentRequestError(413, 'PAYMENT_WEBHOOK_TOO_LARGE', 'Corpo grande demais.')
        }
        const result = await module.useCases.receiveWebhook({
          provider: context.params['provider'] ?? '',
          headers: context.headers,
          rawBody,
        })
        // 200 também no repetido: o provedor só para de reenviar quando recebe 2xx.
        return json({ data: { received: true, ...result } })
      },
    },
  ]

  const customerRoutes: ModuleRoute[] = [
    {
      method: 'GET',
      path: `${prefix}/plans`,
      scope: ROUTE_SCOPE.USER,
      operationId: 'listPaymentPlans',
      summary: 'Planos, com o link de checkout de cada provedor já marcado para a pessoa',
      async handler(context) {
        return json({ data: await module.useCases.listPlans(await identityOf(context)) })
      },
    },
    {
      method: 'GET',
      path: `${prefix}/me`,
      scope: ROUTE_SCOPE.USER,
      operationId: 'getPaymentEntitlement',
      summary: 'Plano atual, situação da assinatura e recursos liberados',
      async handler(context) {
        return json({ data: await module.useCases.getEntitlement(await identityOf(context)) })
      },
    },
    {
      method: 'POST',
      path: `${prefix}/me/claim`,
      scope: ROUTE_SCOPE.USER,
      bodySchema: claimPurchaseBodySchema,
      operationId: 'claimPaymentPurchase',
      summary: 'Resgata para a pessoa uma compra sem dono, pelo código da transação do provedor',
      async handler(context) {
        const body = context.body as z.infer<typeof claimPurchaseBodySchema>
        return json({ data: await module.useCases.claimPurchase(await identityOf(context), body) })
      },
    },
    ...(module.canCancel
      ? [
          {
            method: 'POST',
            path: `${prefix}/me/cancel`,
            scope: ROUTE_SCOPE.USER,
            operationId: 'cancelPaymentSubscription',
            summary: 'Cancela a renovação da assinatura pelo provedor; o acesso segue até o fim do período pago',
            async handler(context: RequestContext) {
              return json({ data: await module.useCases.cancelSubscription(await identityOf(context)) })
            },
          } satisfies ModuleRoute,
        ]
      : []),
  ]

  const adminRoutes: ModuleRoute[] = [
    {
      method: 'GET',
      path: `${prefix}/admin/overview`,
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PAYMENT_SCOPE.READ],
      operationId: 'getPaymentOverview',
      summary: 'Assinaturas por situação e plano, receita e métodos de pagamento em 30 dias',
      async handler() {
        return json({ data: await module.useCases.overview() })
      },
    },
    {
      method: 'GET',
      path: `${prefix}/admin/subscriptions`,
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PAYMENT_SCOPE.READ],
      querySchema: listSubscriptionsQuerySchema,
      operationId: 'listPaymentSubscriptions',
      summary: 'Assinantes, com filtro por situação e busca por nome ou e-mail',
      async handler(context) {
        const query = context.query as unknown as z.infer<typeof listSubscriptionsQuerySchema>
        const { rows, total } = await module.useCases.listSubscriptions(query)
        return json({ data: rows, pagination: { total, page: query.page, perPage: query.perPage } })
      },
    },
    {
      method: 'GET',
      path: `${prefix}/admin/events`,
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PAYMENT_SCOPE.READ],
      querySchema: listPaymentEventsQuerySchema,
      operationId: 'listPaymentEvents',
      summary: 'Últimos avisos recebidos dos provedores',
      async handler(context) {
        const query = context.query as unknown as z.infer<typeof listPaymentEventsQuerySchema>
        const { rows, total } = await module.useCases.listEvents(query)
        return json({ data: rows, pagination: { total, page: query.page, perPage: query.perPage } })
      },
    },
  ]

  return [
    ...(features.webhooks ? webhookRoutes : []),
    ...(features.customer ? customerRoutes : []),
    ...(features.admin ? adminRoutes : []),
  ]
}
