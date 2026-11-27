/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Forma pública do trio de cupons e promoções. Dinheiro sempre em centavos inteiros; datas em ISO
 * 8601 (instante, com fuso). Nenhum dado de empresa aqui: tudo é configuração por campanha.
 */

export const DISCOUNT_KIND = {
  PERCENT: 'percent',
  FIXED: 'fixed',
} as const
export type DiscountKind = (typeof DISCOUNT_KIND)[keyof typeof DISCOUNT_KIND]
export const DISCOUNT_KINDS = Object.values(DISCOUNT_KIND) as readonly DiscountKind[]

/**
 * `fixed`: um código igual para todos (o do banner). `per-lead`: cada pessoa que deixa o contato
 * ganha um código só dela. `batch`: lote gerado no painel (impressos, parceiros), entregue um a um.
 */
export const CODE_MODE = {
  FIXED: 'fixed',
  PER_LEAD: 'per-lead',
  BATCH: 'batch',
} as const
export type CodeMode = (typeof CODE_MODE)[keyof typeof CODE_MODE]
export const CODE_MODES = Object.values(CODE_MODE) as readonly CodeMode[]

export const SCOPE_KIND = {
  ALL: 'all',
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  TAGS: 'tags',
} as const
export type ScopeKind = (typeof SCOPE_KIND)[keyof typeof SCOPE_KIND]
export const SCOPE_KINDS = Object.values(SCOPE_KIND) as readonly ScopeKind[]

export const FIELD_REQUIREMENT = {
  OFF: 'off',
  OPTIONAL: 'optional',
  REQUIRED: 'required',
} as const
export type FieldRequirement = (typeof FIELD_REQUIREMENT)[keyof typeof FIELD_REQUIREMENT]
export const FIELD_REQUIREMENTS = Object.values(FIELD_REQUIREMENT) as readonly FieldRequirement[]

export const COUPON_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const
export type CouponStatus = (typeof COUPON_STATUS)[keyof typeof COUPON_STATUS]
export const COUPON_STATUSES = Object.values(COUPON_STATUS) as readonly CouponStatus[]

export const REDEMPTION_STATUS = {
  REDEEMED: 'redeemed',
  RELEASED: 'released',
} as const
export type RedemptionStatus = (typeof REDEMPTION_STATUS)[keyof typeof REDEMPTION_STATUS]
export const REDEMPTION_STATUSES = Object.values(REDEMPTION_STATUS) as readonly RedemptionStatus[]

/** Por que um cupom não vale. A lista vem inteira: o operador vê todos os motivos de uma vez. */
export const COUPON_REJECTION = {
  NOT_FOUND: 'not_found',
  CAMPAIGN_INACTIVE: 'campaign_inactive',
  COUPON_DISABLED: 'coupon_disabled',
  NOT_STARTED: 'not_started',
  EXPIRED: 'expired',
  TOTAL_LIMIT_REACHED: 'total_limit_reached',
  CODE_LIMIT_REACHED: 'code_limit_reached',
  CUSTOMER_LIMIT_REACHED: 'customer_limit_reached',
  CUSTOMER_REQUIRED: 'customer_required',
  EMPTY_CART: 'empty_cart',
  NO_ELIGIBLE_ITEMS: 'no_eligible_items',
  MIN_SUBTOTAL_NOT_MET: 'min_subtotal_not_met',
  /** O cálculo deu zero (ex.: 1% de poucos centavos): cupom que não desconta nada não é aplicado. */
  ZERO_DISCOUNT: 'zero_discount',
  /** Resposta genérica do site anônimo: não diz se o código existe nem por que não vale. */
  NOT_APPLICABLE: 'not_applicable',
} as const
export type CouponRejection = (typeof COUPON_REJECTION)[keyof typeof COUPON_REJECTION]

export type CampaignDiscount = {
  readonly kind: DiscountKind
  /** `percent`: 1 a 100. `fixed`: centavos. */
  readonly value: number
  /** Teto do desconto em centavos (útil no percentual). `null`: sem teto. */
  readonly maxDiscountCents: number | null
  /** Subtotal elegível mínimo em centavos. `null`: sem mínimo. */
  readonly minSubtotalCents: number | null
}

export type CampaignScope =
  | { readonly kind: 'all' }
  | { readonly kind: 'products'; readonly productIds: readonly string[] }
  | { readonly kind: 'categories'; readonly categoryIds: readonly string[] }
  | { readonly kind: 'tags'; readonly tags: readonly string[] }

export type LeadCaptureFields = {
  readonly name: FieldRequirement
  readonly phone: FieldRequirement
  readonly email: FieldRequirement
}

export type LeadCaptureSettings = {
  readonly enabled: boolean
  readonly fields: LeadCaptureFields
  /** Texto do aceite (LGPD) que a pessoa marca. Guardado junto do lead, como prova do que aceitou. */
  readonly consentText: string
}

export type Campaign = {
  readonly id: string
  readonly companyId: string
  /** Nome interno, só no painel. */
  readonly name: string
  /** Título público (banner, diálogo). */
  readonly title: string
  readonly text: string
  readonly terms: string
  readonly isActive: boolean
  /** Início inclusivo. `null`: desde já. */
  readonly startsAt: string | null
  /** Fim exclusivo. `null`: sem fim. */
  readonly endsAt: string | null
  readonly discount: CampaignDiscount
  readonly codeMode: CodeMode
  /** Só em `fixed`. */
  readonly fixedCode: string | null
  /** Prefixo dos códigos gerados (`per-lead` e `batch`). */
  readonly codePrefix: string | null
  readonly usageLimitTotal: number | null
  readonly usageLimitPerCustomer: number | null
  /** Usos por código. `null`: sem limite. Lote e por lead costumam ser 1. */
  readonly usageLimitPerCode: number | null
  readonly scope: CampaignScope
  /** Vale sem digitar código: o host pergunta `findAutomatic` no carrinho. */
  readonly isAutomatic: boolean
  readonly leadCapture: LeadCaptureSettings
  /** Etiqueta do cliente captado por esta campanha (o host aplica no `onLeadCaptured`). */
  readonly leadTag: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type CampaignStats = {
  readonly redemptionCount: number
  readonly discountCents: number
  readonly leadCount: number
}

export type CampaignListItem = Campaign & { readonly stats: CampaignStats }

/** O que o site mostra: nada de código, limite ou contagem. */
export type PublicCampaign = {
  readonly id: string
  readonly title: string
  readonly text: string
  readonly terms: string
  readonly startsAt: string | null
  readonly endsAt: string | null
  readonly discount: CampaignDiscount
  readonly isAutomatic: boolean
  readonly leadCapture: LeadCaptureSettings
}

export type Coupon = {
  readonly id: string
  readonly companyId: string
  readonly campaignId: string
  readonly code: string
  readonly leadId: string | null
  readonly usedCount: number
  readonly status: CouponStatus
  readonly createdAt: string
}

/**
 * Pessoa que deixou o contato. `phone` canônico (só dígitos, com DDI); `email` minúsculo. O que a
 * campanha não pediu fica `null`.
 */
export type Lead = {
  readonly id: string
  readonly companyId: string
  readonly campaignId: string
  readonly name: string | null
  readonly phone: string | null
  readonly email: string | null
  readonly customerRef: string | null
  readonly couponCode: string | null
  readonly consentText: string
  readonly consentedAt: string
  readonly createdAt: string
}

/** Referência opaca do pedido no host (`kind` = "reservation", "order"…). O módulo não a interpreta. */
export type OrderRef = {
  readonly kind: string
  readonly id: string
}

export type Redemption = {
  readonly id: string
  readonly companyId: string
  readonly campaignId: string
  /** `null` em campanha automática. */
  readonly couponCode: string | null
  readonly orderRef: OrderRef
  readonly customerRef: string | null
  readonly subtotalCents: number
  readonly discountCents: number
  readonly status: RedemptionStatus
  readonly redeemedAt: string
  readonly releasedAt: string | null
}

export type CartItem = {
  readonly productId: string
  readonly categoryIds?: readonly string[]
  readonly tags?: readonly string[]
  readonly priceCents: number
  readonly quantity: number
}

export type CouponValidation = {
  readonly valid: boolean
  readonly discountCents: number
  readonly subtotalCents: number
  readonly eligibleSubtotalCents: number
  readonly reasons: readonly CouponRejection[]
  /** Presente quando o código existe, mesmo inválido: a tela diz de qual campanha é. */
  readonly campaign?: PublicCampaign
  readonly code?: string | null
}

export type CampaignReport = {
  readonly campaignId: string
  readonly redemptionCount: number
  readonly releasedCount: number
  readonly discountCents: number
  readonly subtotalCents: number
  readonly leadCount: number
  readonly couponCount: number
  readonly usedCouponCount: number
}

export type Pagination = {
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
}

export type Paginated<TItem> = {
  readonly data: readonly TItem[]
  readonly pagination: Pagination
}

/**
 * Resultado explícito da captação, para o site nunca mostrar um código vazio:
 * - `created`: cadastro novo, `couponCode` preenchido;
 * - `already-registered`: a pessoa já estava; `couponCode` só no modo fixo (é público). Nos outros
 *   modos volta `null`, e `codeResent` diz se o código foi reenviado ao contato guardado (só quando o
 *   contato informado é exatamente o guardado).
 */
export const CAPTURE_OUTCOME = {
  CREATED: 'created',
  ALREADY_REGISTERED: 'already-registered',
} as const
export type CaptureOutcome = (typeof CAPTURE_OUTCOME)[keyof typeof CAPTURE_OUTCOME]

export type CaptureLeadResult = {
  readonly leadId: string
  readonly outcome: CaptureOutcome
  /** `false`: a pessoa já estava cadastrada; nada novo foi gravado. Mesmo que `outcome`. */
  readonly isNew: boolean
  /** `true` quando o código foi (re)enviado pelo `leadNotifier` agora. */
  readonly codeResent: boolean
  /**
   * O código, quando pode ir para a tela: sempre no modo `fixed` (é público) e no primeiro cadastro
   * dos outros modos. Cadastro repetido de código pessoal volta sem ele — só o dono recebe de novo,
   * pelo canal do aviso.
   */
  readonly couponCode: string | null
  readonly discount: CampaignDiscount
  readonly endsAt: string | null
}

/** Cotação: o desconto calculado sobre o pedido, sem resgatar. */
export type CouponQuote = CouponValidation & {
  /** Subtotal menos o desconto (nunca negativo). */
  readonly totalCents: number
}
