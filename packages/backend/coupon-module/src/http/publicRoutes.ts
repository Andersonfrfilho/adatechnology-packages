/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas do site. Sem identidade: a empresa vem do `PublicCompanyResolverPort` do host, e toda rota
 * que escreve ou confere código passa pelo `RateLimiterPort` (força bruta de código, spam de e-mail).
 */

import {
  CampaignUnavailableError,
  captureLeadSchema,
  COUPON_ERROR_CODES,
  DEFAULT_PUBLIC_CACHE_CONTROL,
  publicValidateCouponSchema,
  RATE_LIMIT_ACTION,
  type CaptureLeadInput,
  type CartItem,
  type RateLimitAction,
  type RateLimiterPort,
} from '@adatechnology/coupon-contracts'
import type { HttpResult, ModuleRoute, RequestContext } from '@adatechnology/module-http'

import type { CouponModule } from '../CouponModule'
import { json } from './requireCompany'

export interface PublicCompanyResolverPort {
  resolve(params: {
    readonly headers: Readonly<Record<string, string>>
    readonly query: Readonly<Record<string, string>>
  }): Promise<string | undefined>
}

const PUBLIC = { scope: 'public' as const }

export function buildPublicRoutes(params: {
  readonly module: CouponModule
  readonly companyResolver: PublicCompanyResolverPort
  readonly rateLimiter: RateLimiterPort
}): ModuleRoute[] {
  const { useCases } = params.module
  const cacheControl = params.module.config.publicCacheControl ?? DEFAULT_PUBLIC_CACHE_CONTROL

  async function resolveCompany(context: RequestContext): Promise<string> {
    const companyId = await params.companyResolver.resolve({ headers: context.headers, query: context.query })
    if (!companyId) throw new CampaignUnavailableError()
    return companyId
  }

  /** `undefined` quando pode seguir; senão a resposta 429 pronta, com `Retry-After`. */
  async function limit(
    action: RateLimitAction,
    companyId: string,
    context: RequestContext,
  ): Promise<HttpResult | undefined> {
    const decision = await params.rateLimiter.consume({ action, companyId, key: context.ip ?? 'unknown' })
    if (decision.allowed) return undefined
    const retryAfter = decision.retryAfterSeconds
    return {
      kind: 'json',
      status: 429,
      body: {
        error: { code: COUPON_ERROR_CODES.RATE_LIMITED, message: 'Muitas tentativas. Tente de novo em instantes.' },
      },
      ...(retryAfter === undefined ? {} : { headers: { 'Retry-After': String(retryAfter) } }),
    }
  }

  return [
    {
      ...PUBLIC,
      method: 'GET',
      path: '/public/campaigns',
      operationId: 'listOpenCampaigns',
      summary: 'Campanhas no ar, para o banner do site (sem código, limite nem contagem)',
      async handler(context) {
        const data = await useCases.listPublicCampaigns.execute({ companyId: await resolveCompany(context) })
        return { kind: 'json', status: 200, body: { data }, headers: { 'Cache-Control': cacheControl } }
      },
    },
    {
      ...PUBLIC,
      method: 'GET',
      path: '/public/campaigns/:id',
      operationId: 'getOpenCampaign',
      summary: 'Uma campanha no ar; desligada, fora do período ou inexistente respondem 404',
      async handler(context) {
        const data = await useCases.getPublicCampaign.execute({
          companyId: await resolveCompany(context),
          id: context.params.id ?? '',
        })
        return { kind: 'json', status: 200, body: { data }, headers: { 'Cache-Control': cacheControl } }
      },
    },
    {
      ...PUBLIC,
      method: 'POST',
      path: '/public/coupons/validate',
      bodySchema: publicValidateCouponSchema,
      operationId: 'previewCoupon',
      summary: 'Prévia do desconto para o carrinho do site (limite por cliente só no resgate)',
      async handler(context) {
        const companyId = await resolveCompany(context)
        const limited = await limit(RATE_LIMIT_ACTION.VALIDATE, companyId, context)
        if (limited) return limited
        const body = context.body as { code: string; items: CartItem[] }
        return json(200, await useCases.validateCoupon.execute({ companyId, code: body.code, items: body.items }))
      },
    },
    {
      ...PUBLIC,
      method: 'POST',
      path: '/public/campaigns/:id/leads',
      bodySchema: captureLeadSchema,
      operationId: 'captureCampaignLead',
      summary: 'Deixa o contato e recebe o código: 201 no primeiro cadastro, 200 ao repetir',
      async handler(context) {
        const companyId = await resolveCompany(context)
        const limited = await limit(RATE_LIMIT_ACTION.LEAD_CAPTURE, companyId, context)
        if (limited) return limited
        const input = context.body as CaptureLeadInput
        const result = await useCases.captureLead.execute({ companyId, campaignId: context.params.id ?? '', input })
        return json(result.isNew ? 201 : 200, result)
      },
    },
  ]
}
