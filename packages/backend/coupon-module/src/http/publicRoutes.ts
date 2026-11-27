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
  COUPON_REJECTION,
  DEFAULT_PUBLIC_CACHE_CONTROL,
  publicValidateCouponSchema,
  RATE_LIMIT_ACTION,
  type CaptureLeadInput,
  type CartItem,
  type CouponValidation,
  type RateLimitAction,
  type RateLimiterPort,
} from '@adatechnology/coupon-contracts'
import type { HttpResult, ModuleRoute, RequestContext } from '@adatechnology/module-http'

import type { CouponModule } from '../CouponModule'
import { json, uuidParam } from './requireCompany'

export interface PublicCompanyResolverPort {
  resolve(params: {
    readonly headers: Readonly<Record<string, string>>
    readonly query: Readonly<Record<string, string>>
  }): Promise<string | undefined>
  /**
   * Cabeçalhos que o resolvedor lê além do `Host` (ex.: `X-Tenant`). Entram no `Vary` das respostas
   * em cache, para um cache compartilhado nunca servir a campanha de uma empresa a outra. Resolvedor
   * que lê a query string deve usar `publicCacheControl: 'private, …'`.
   */
  readonly varyHeaders?: readonly string[]
}

const PUBLIC = { scope: 'public' as const }

/**
 * O site anônimo não aprende nada com a prévia recusada: nem se o código existe, nem de qual
 * campanha é, nem por quê. Os motivos detalhados ficam na rota de serviço do backend do host.
 */
export function toPublicValidation(validation: CouponValidation): CouponValidation {
  if (validation.valid) return validation
  return {
    valid: false,
    discountCents: 0,
    subtotalCents: validation.subtotalCents,
    eligibleSubtotalCents: 0,
    reasons: [COUPON_REJECTION.NOT_APPLICABLE],
  }
}

function tooManyRequests(retryAfter: number | undefined): HttpResult {
  return {
    kind: 'json',
    status: 429,
    body: {
      error: { code: COUPON_ERROR_CODES.RATE_LIMITED, message: 'Muitas tentativas. Tente de novo em instantes.' },
    },
    ...(retryAfter === undefined ? {} : { headers: { 'Retry-After': String(retryAfter) } }),
  }
}

export function buildPublicRoutes(params: {
  readonly module: CouponModule
  readonly companyResolver: PublicCompanyResolverPort
  readonly rateLimiter: RateLimiterPort
}): ModuleRoute[] {
  const { useCases } = params.module
  const cacheHeaders = {
    'Cache-Control': params.module.config.publicCacheControl ?? DEFAULT_PUBLIC_CACHE_CONTROL,
    Vary: ['Host', ...(params.companyResolver.varyHeaders ?? [])].join(', '),
  }
  const cached = (data: unknown): HttpResult => ({ kind: 'json', status: 200, body: { data }, headers: cacheHeaders })
  const campaignParam = (context: RequestContext) => uuidParam(context, 'id', () => new CampaignUnavailableError())

  async function resolveCompany(context: RequestContext): Promise<string> {
    const companyId = await params.companyResolver.resolve({ headers: context.headers, query: context.query })
    if (!companyId) throw new CampaignUnavailableError()
    return companyId
  }

  /**
   * `undefined` quando pode seguir; senão a resposta 429. Sem IP resolvido não há chave para limitar:
   * recusa (fail-closed) em vez de juntar todo mundo numa chave só ou deixar passar sem limite.
   */
  async function limit(
    checks: readonly { action: RateLimitAction; key: string | undefined }[],
    companyId: string,
  ): Promise<HttpResult | undefined> {
    for (const check of checks) {
      if (!check.key) return tooManyRequests(undefined)
      const decision = await params.rateLimiter.consume({ action: check.action, companyId, key: check.key })
      if (!decision.allowed) return tooManyRequests(decision.retryAfterSeconds)
    }
    return undefined
  }

  return [
    {
      ...PUBLIC,
      method: 'GET',
      path: '/public/campaigns',
      operationId: 'listOpenCampaigns',
      summary: 'Campanhas no ar, para o banner do site (sem código, limite nem contagem)',
      async handler(context) {
        return cached(await useCases.listPublicCampaigns.execute({ companyId: await resolveCompany(context) }))
      },
    },
    {
      ...PUBLIC,
      method: 'GET',
      path: '/public/campaigns/:id',
      operationId: 'getOpenCampaign',
      summary: 'Uma campanha no ar; desligada, fora do período, inexistente ou id inválido respondem 404',
      async handler(context) {
        const id = campaignParam(context)
        return cached(await useCases.getPublicCampaign.execute({ companyId: await resolveCompany(context), id }))
      },
    },
    {
      ...PUBLIC,
      method: 'POST',
      path: '/public/coupons/validate',
      bodySchema: publicValidateCouponSchema,
      operationId: 'previewCoupon',
      summary:
        'Prévia do desconto para o carrinho do site; recusa sai genérica (`not_applicable`), sem motivo nem campanha',
      async handler(context) {
        const companyId = await resolveCompany(context)
        const limited = await limit([{ action: RATE_LIMIT_ACTION.VALIDATE, key: context.ip }], companyId)
        if (limited) return limited
        const body = context.body as { code: string; items: CartItem[] }
        const validation = await useCases.validateCoupon.execute({ companyId, code: body.code, items: body.items })
        return json(200, toPublicValidation(validation))
      },
    },
    {
      ...PUBLIC,
      method: 'POST',
      path: '/public/campaigns/:id/leads',
      bodySchema: captureLeadSchema,
      operationId: 'captureCampaignLead',
      summary: 'Deixa o contato e recebe o código; 200 tanto no primeiro cadastro quanto na repetição',
      async handler(context) {
        const campaignId = campaignParam(context)
        const companyId = await resolveCompany(context)
        const limited = await limit(
          [
            { action: RATE_LIMIT_ACTION.LEAD_CAPTURE, key: context.ip },
            { action: RATE_LIMIT_ACTION.LEAD_CAPTURE_CAMPAIGN, key: `${companyId}:${campaignId}` },
          ],
          companyId,
        )
        if (limited) return limited
        const input = context.body as CaptureLeadInput
        // Mesmo status para novo e repetido: o código HTTP não confirma se um contato já está cadastrado.
        return json(200, await useCases.captureLead.execute({ companyId, campaignId, input }))
      },
    },
  ]
}
