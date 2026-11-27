/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Validação de fronteira. Os mesmos schemas servem a rota do módulo e o formulário do painel.
 */

import { z } from 'zod'

import {
  CODE_PREFIX_PATTERN,
  COUPON_CODE_MAX_LENGTH,
  COUPON_CODE_PATTERN,
  normalizeCodePrefix,
  normalizeCouponCode,
} from './code'
import {
  CODE_MODE,
  CODE_MODES,
  DISCOUNT_KIND,
  DISCOUNT_KINDS,
  FIELD_REQUIREMENT,
  FIELD_REQUIREMENTS,
  REDEMPTION_STATUSES,
  type CodeMode,
  type DiscountKind,
  type FieldRequirement,
  type RedemptionStatus,
} from './coupon.types'

export const COUPON_LIMITS = {
  NAME: 120,
  TITLE: 160,
  TEXT: 1000,
  TERMS: 3000,
  CONSENT_TEXT: 600,
  SEARCH: 120,
  SCOPE_ITEMS: 500,
  SCOPE_ITEM: 120,
  CART_ITEMS: 500,
  BATCH_MAX: 10_000,
  PAGE_SIZE: 100,
  EXPORT_ROWS: 50_000,
  ORDER_KIND: 40,
  ORDER_ID: 120,
  CUSTOMER_REF: 120,
  LEAD_NAME: 120,
} as const

export const CAMPAIGN_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'startsAt', 'endsAt'] as const
export type CampaignSortField = (typeof CAMPAIGN_SORT_FIELDS)[number]

/** Situação derivada (ligada + período), usada no filtro da lista. */
export const CAMPAIGN_STATE = {
  RUNNING: 'running',
  SCHEDULED: 'scheduled',
  ENDED: 'ended',
  INACTIVE: 'inactive',
} as const
export type CampaignState = (typeof CAMPAIGN_STATE)[keyof typeof CAMPAIGN_STATE]
export const CAMPAIGN_STATES = Object.values(CAMPAIGN_STATE) as readonly CampaignState[]

export const EXPORT_FORMAT = { CSV: 'csv', XLSX: 'xlsx' } as const
export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT]

const pageSchema = z.coerce.number().int().min(1).default(1)
const pageSizeSchema = z.coerce.number().int().min(1).max(COUPON_LIMITS.PAGE_SIZE).default(20)
const searchSchema = z.string().trim().min(1).max(COUPON_LIMITS.SEARCH).optional()
const orderSchema = z.enum(['asc', 'desc']).default('desc')
const centsSchema = z.number().int().min(0).max(1_000_000_000)
const limitSchema = z.number().int().min(1).max(1_000_000).nullable()
const instantSchema = z.string().datetime({ offset: true }).nullable()

export const couponCodeSchema = z
  .string()
  .max(COUPON_CODE_MAX_LENGTH * 2)
  .transform(normalizeCouponCode)
  .refine((code) => COUPON_CODE_PATTERN.test(code), { message: 'Use 3 a 32 letras, números ou hífen.' })

export const codePrefixSchema = z
  .string()
  .max(24)
  .transform(normalizeCodePrefix)
  .refine((prefix) => prefix === '' || CODE_PREFIX_PATTERN.test(prefix), {
    message: 'Prefixo de até 12 letras ou números.',
  })

export const discountSchema = z
  .object({
    kind: z.enum(DISCOUNT_KINDS as [DiscountKind, ...DiscountKind[]]),
    value: z.number().int().min(1),
    maxDiscountCents: centsSchema.nullable().default(null),
    minSubtotalCents: centsSchema.nullable().default(null),
  })
  .superRefine((discount, context) => {
    if (discount.kind === DISCOUNT_KIND.PERCENT && discount.value > 100)
      context.addIssue({ code: 'custom', path: ['value'], message: 'Percentual entre 1 e 100.' })
    if (discount.kind === DISCOUNT_KIND.FIXED && discount.value > 1_000_000_000)
      context.addIssue({ code: 'custom', path: ['value'], message: 'Valor alto demais.' })
  })

const scopeListSchema = z
  .array(z.string().trim().min(1).max(COUPON_LIMITS.SCOPE_ITEM))
  .min(1)
  .max(COUPON_LIMITS.SCOPE_ITEMS)

export const scopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('products'), productIds: scopeListSchema }),
  z.object({ kind: z.literal('categories'), categoryIds: scopeListSchema }),
  z.object({ kind: z.literal('tags'), tags: scopeListSchema }),
])

const fieldRequirementSchema = z.enum(FIELD_REQUIREMENTS as [FieldRequirement, ...FieldRequirement[]])

export const leadCaptureSchema = z.object({
  enabled: z.boolean().default(false),
  fields: z
    .object({
      name: fieldRequirementSchema.default(FIELD_REQUIREMENT.OPTIONAL),
      phone: fieldRequirementSchema.default(FIELD_REQUIREMENT.REQUIRED),
      email: fieldRequirementSchema.default(FIELD_REQUIREMENT.REQUIRED),
    })
    .default({}),
  consentText: z.string().trim().max(COUPON_LIMITS.CONSENT_TEXT).default(''),
})

const campaignFieldsShape = {
  name: z.string().trim().min(1).max(COUPON_LIMITS.NAME),
  title: z.string().trim().max(COUPON_LIMITS.TITLE).default(''),
  text: z.string().trim().max(COUPON_LIMITS.TEXT).default(''),
  terms: z.string().trim().max(COUPON_LIMITS.TERMS).default(''),
  isActive: z.boolean().default(false),
  startsAt: instantSchema.default(null),
  endsAt: instantSchema.default(null),
  discount: discountSchema,
  fixedCode: couponCodeSchema.nullable().default(null),
  codePrefix: codePrefixSchema.nullable().default(null),
  usageLimitTotal: limitSchema.default(null),
  usageLimitPerCustomer: limitSchema.default(null),
  usageLimitPerCode: limitSchema.default(null),
  scope: scopeSchema.default({ kind: 'all' }),
  isAutomatic: z.boolean().default(false),
  leadCapture: leadCaptureSchema.default({}),
}

/** Regras que cruzam campos. Valem na criação e, depois do merge, na edição. */
export type CampaignRuleIssue = { readonly field: string; readonly message: string }

export function checkCampaignRules(campaign: {
  readonly startsAt: string | null
  readonly endsAt: string | null
  readonly codeMode: CodeMode
  readonly isAutomatic: boolean
  readonly leadCapture: z.output<typeof leadCaptureSchema>
}): CampaignRuleIssue[] {
  const issues: CampaignRuleIssue[] = []
  if (campaign.startsAt && campaign.endsAt && Date.parse(campaign.endsAt) <= Date.parse(campaign.startsAt))
    issues.push({ field: 'endsAt', message: 'O fim precisa ser depois do início.' })
  const { fields } = campaign.leadCapture
  if (
    campaign.leadCapture.enabled &&
    fields.phone !== FIELD_REQUIREMENT.REQUIRED &&
    fields.email !== FIELD_REQUIREMENT.REQUIRED
  )
    issues.push({
      field: 'leadCapture.fields',
      message: 'Exija telefone ou e-mail: é por eles que o contato não se repete.',
    })
  if (campaign.leadCapture.enabled && !campaign.leadCapture.consentText)
    issues.push({ field: 'leadCapture.consentText', message: 'Escreva o texto do aceite (LGPD).' })
  if (campaign.isAutomatic && campaign.leadCapture.enabled)
    issues.push({
      field: 'leadCapture.enabled',
      message: 'Campanha automática não entrega código: desligue a captação.',
    })
  if (campaign.isAutomatic && campaign.codeMode !== CODE_MODE.FIXED)
    issues.push({ field: 'codeMode', message: 'Campanha automática usa o modo de código fixo.' })
  return issues
}

export const createCampaignSchema = z
  .object({
    ...campaignFieldsShape,
    codeMode: z.enum(CODE_MODES as [CodeMode, ...CodeMode[]]).default(CODE_MODE.FIXED),
  })
  .superRefine((campaign, context) => {
    for (const issue of checkCampaignRules(campaign))
      context.addIssue({ code: 'custom', path: issue.field.split('.'), message: issue.message })
  })
export type CreateCampaignInput = z.input<typeof createCampaignSchema>
export type CreateCampaignData = z.output<typeof createCampaignSchema>

/** `codeMode` não muda depois de criada: códigos já entregues deixariam de fazer sentido. */
export const updateCampaignSchema = z.object({
  name: campaignFieldsShape.name.optional(),
  title: z.string().trim().max(COUPON_LIMITS.TITLE).optional(),
  text: z.string().trim().max(COUPON_LIMITS.TEXT).optional(),
  terms: z.string().trim().max(COUPON_LIMITS.TERMS).optional(),
  isActive: z.boolean().optional(),
  startsAt: instantSchema.optional(),
  endsAt: instantSchema.optional(),
  discount: discountSchema.optional(),
  fixedCode: couponCodeSchema.nullable().optional(),
  codePrefix: codePrefixSchema.nullable().optional(),
  usageLimitTotal: limitSchema.optional(),
  usageLimitPerCustomer: limitSchema.optional(),
  usageLimitPerCode: limitSchema.optional(),
  scope: scopeSchema.optional(),
  isAutomatic: z.boolean().optional(),
  leadCapture: leadCaptureSchema.optional(),
})
export type UpdateCampaignInput = z.input<typeof updateCampaignSchema>
export type UpdateCampaignData = z.output<typeof updateCampaignSchema>

/** Vários valores separados por vírgula: `state=running,scheduled`. */
function csvEnum<TValue extends string>(values: readonly TValue[]) {
  return z
    .string()
    .trim()
    .min(1)
    .max(200)
    .transform((raw) => raw.split(',').map((value) => value.trim()))
    .refine((list): list is TValue[] => list.every((value) => (values as readonly string[]).includes(value)), {
      message: `Valores aceitos: ${values.join(', ')}.`,
    })
    .optional()
}

export const listCampaignsQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  search: searchSchema,
  state: csvEnum(CAMPAIGN_STATES),
  sort: z.enum(CAMPAIGN_SORT_FIELDS).default('createdAt'),
  order: orderSchema,
})
export type ListCampaignsQuery = z.output<typeof listCampaignsQuerySchema>

export const generateCodesSchema = z.object({
  count: z.number().int().min(1).max(COUPON_LIMITS.BATCH_MAX),
  prefix: codePrefixSchema.optional(),
})
export type GenerateCodesInput = z.input<typeof generateCodesSchema>

export const cartItemSchema = z.object({
  productId: z.string().trim().min(1).max(COUPON_LIMITS.SCOPE_ITEM),
  categoryIds: z.array(z.string().max(COUPON_LIMITS.SCOPE_ITEM)).max(50).optional(),
  tags: z.array(z.string().max(COUPON_LIMITS.SCOPE_ITEM)).max(50).optional(),
  priceCents: centsSchema,
  quantity: z.number().int().min(1).max(100_000),
})

const cartSchema = z.array(cartItemSchema).max(COUPON_LIMITS.CART_ITEMS)
const customerRefSchema = z.string().trim().min(1).max(COUPON_LIMITS.CUSTOMER_REF)

export const orderRefSchema = z.object({
  kind: z.string().trim().min(1).max(COUPON_LIMITS.ORDER_KIND),
  id: z.string().trim().min(1).max(COUPON_LIMITS.ORDER_ID),
})

export const validateCouponSchema = z.object({
  code: couponCodeSchema,
  items: cartSchema,
  customerRef: customerRefSchema.optional(),
  at: z.string().datetime({ offset: true }).optional(),
})
export type ValidateCouponInput = z.input<typeof validateCouponSchema>

/** Site público: sem `customerRef` nem `at` — quem chama é anônimo e não escolhe a identidade nem o relógio. */
export const publicValidateCouponSchema = z.object({ code: couponCodeSchema, items: cartSchema })
export type PublicValidateCouponInput = z.input<typeof publicValidateCouponSchema>

export const findAutomaticSchema = z.object({
  items: cartSchema,
  customerRef: customerRefSchema.optional(),
  at: z.string().datetime({ offset: true }).optional(),
})
export type FindAutomaticInput = z.input<typeof findAutomaticSchema>

/** Com `code`, resgata o cupom; sem, a campanha automática `campaignId`. */
export const redeemCouponSchema = z
  .object({
    code: couponCodeSchema.optional(),
    campaignId: z.string().uuid().optional(),
    orderRef: orderRefSchema,
    items: cartSchema,
    customerRef: customerRefSchema.optional(),
  })
  .refine((input) => (input.code === undefined) !== (input.campaignId === undefined), {
    message: 'Informe o código ou a campanha automática, um dos dois.',
    path: ['code'],
  })
export type RedeemCouponInput = z.input<typeof redeemCouponSchema>

export const releaseRedemptionSchema = z.object({ orderRef: orderRefSchema })
export type ReleaseRedemptionInput = z.input<typeof releaseRedemptionSchema>

export const captureLeadSchema = z.object({
  name: z.string().trim().max(COUPON_LIMITS.LEAD_NAME).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(254).optional(),
  consent: z.boolean(),
})
export type CaptureLeadInput = z.input<typeof captureLeadSchema>

export const listLeadsQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  /** Nome ou e-mail; telefone compara só os dígitos. */
  search: searchSchema,
  sort: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
  order: orderSchema,
})
export type ListLeadsQuery = z.output<typeof listLeadsQuerySchema>

export const listRedemptionsQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  /** Código do cupom ou id do pedido. */
  search: searchSchema,
  status: csvEnum(REDEMPTION_STATUSES as readonly RedemptionStatus[]),
  sort: z.enum(['redeemedAt', 'discountCents', 'subtotalCents']).default('redeemedAt'),
  order: orderSchema,
})
export type ListRedemptionsQuery = z.output<typeof listRedemptionsQuerySchema>

export const listCouponsQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  search: searchSchema,
  /** `true`: só os que ainda não foram entregues a ninguém (lote). */
  unassigned: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
  order: orderSchema,
})
export type ListCouponsQuery = z.output<typeof listCouponsQuerySchema>

export const exportFormatSchema = z.object({ format: z.enum([EXPORT_FORMAT.CSV, EXPORT_FORMAT.XLSX]).default('csv') })
