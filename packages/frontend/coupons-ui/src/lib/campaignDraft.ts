/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Formulário da campanha como dado puro: rascunho ↔ campanha ↔ corpo da API, e validação com os
 * MESMOS schemas do servidor (`coupon-contracts`). Nada de regra duplicada no componente.
 */

import {
  checkCampaignRules,
  createCampaignSchema,
  updateCampaignSchema,
  type Campaign,
  type CodeMode,
  type CreateCampaignInput,
  type DiscountKind,
  type FieldIssue,
  type LeadCaptureFields,
  type ScopeKind,
} from '@adatechnology/coupon-contracts'

import { fromDateTimeLocalValue, toDateTimeLocalValue } from './format'

export type CampaignDraft = {
  readonly name: string
  readonly title: string
  readonly text: string
  readonly terms: string
  readonly isActive: boolean
  /** `YYYY-MM-DDTHH:mm` local. */
  readonly startsAt: string
  readonly endsAt: string
  readonly discountKind: DiscountKind
  /** Percentual (1–100) digitado. */
  readonly percent: string
  readonly fixedCents: number | null
  readonly maxDiscountCents: number | null
  readonly minSubtotalCents: number | null
  readonly codeMode: CodeMode
  readonly fixedCode: string
  readonly codePrefix: string
  readonly usageLimitTotal: string
  readonly usageLimitPerCustomer: string
  readonly usageLimitPerCode: string
  readonly scopeKind: ScopeKind
  /** Ids ou etiquetas separados por vírgula. */
  readonly scopeValues: string
  readonly isAutomatic: boolean
  readonly leadCaptureEnabled: boolean
  readonly leadFields: LeadCaptureFields
  readonly consentText: string
  readonly leadTag: string
}

export const EMPTY_CAMPAIGN_DRAFT: CampaignDraft = {
  name: '',
  title: '',
  text: '',
  terms: '',
  isActive: false,
  startsAt: '',
  endsAt: '',
  discountKind: 'percent',
  percent: '10',
  fixedCents: null,
  maxDiscountCents: null,
  minSubtotalCents: null,
  codeMode: 'fixed',
  fixedCode: '',
  codePrefix: '',
  usageLimitTotal: '',
  usageLimitPerCustomer: '',
  usageLimitPerCode: '',
  scopeKind: 'all',
  scopeValues: '',
  isAutomatic: false,
  leadCaptureEnabled: false,
  leadFields: { name: 'optional', phone: 'required', email: 'required' },
  consentText: '',
  leadTag: '',
}

const limitText = (value: number | null) => (value === null ? '' : String(value))

function scopeValuesOf(campaign: Campaign): string {
  const { scope } = campaign
  if (scope.kind === 'products') return scope.productIds.join(', ')
  if (scope.kind === 'categories') return scope.categoryIds.join(', ')
  if (scope.kind === 'tags') return scope.tags.join(', ')
  return ''
}

export function draftFromCampaign(campaign: Campaign, timeZone?: string): CampaignDraft {
  const { discount } = campaign
  return {
    name: campaign.name,
    title: campaign.title,
    text: campaign.text,
    terms: campaign.terms,
    isActive: campaign.isActive,
    startsAt: toDateTimeLocalValue(campaign.startsAt, timeZone),
    endsAt: toDateTimeLocalValue(campaign.endsAt, timeZone),
    discountKind: discount.kind,
    percent: discount.kind === 'percent' ? String(discount.value) : '',
    fixedCents: discount.kind === 'fixed' ? discount.value : null,
    maxDiscountCents: discount.maxDiscountCents,
    minSubtotalCents: discount.minSubtotalCents,
    codeMode: campaign.codeMode,
    fixedCode: campaign.fixedCode ?? '',
    codePrefix: campaign.codePrefix ?? '',
    usageLimitTotal: limitText(campaign.usageLimitTotal),
    usageLimitPerCustomer: limitText(campaign.usageLimitPerCustomer),
    usageLimitPerCode: limitText(campaign.usageLimitPerCode),
    scopeKind: campaign.scope.kind,
    scopeValues: scopeValuesOf(campaign),
    isAutomatic: campaign.isAutomatic,
    leadCaptureEnabled: campaign.leadCapture.enabled,
    leadFields: campaign.leadCapture.fields,
    consentText: campaign.leadCapture.consentText,
    leadTag: campaign.leadTag ?? '',
  }
}

/** Texto vazio é "sem limite"; texto que não é inteiro vai como está e o schema recusa no campo. */
function limitValue(raw: string): number | null {
  const trimmed = raw.trim()
  return trimmed === '' ? null : Number(trimmed)
}

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function scopeOf(draft: CampaignDraft): CreateCampaignInput['scope'] {
  const values = splitList(draft.scopeValues)
  if (draft.scopeKind === 'products') return { kind: 'products', productIds: values }
  if (draft.scopeKind === 'categories') return { kind: 'categories', categoryIds: values }
  if (draft.scopeKind === 'tags') return { kind: 'tags', tags: values }
  return { kind: 'all' }
}

export function draftToInput(draft: CampaignDraft, timeZone?: string): CreateCampaignInput {
  return {
    name: draft.name,
    title: draft.title,
    text: draft.text,
    terms: draft.terms,
    isActive: draft.isActive,
    startsAt: fromDateTimeLocalValue(draft.startsAt, timeZone),
    endsAt: fromDateTimeLocalValue(draft.endsAt, timeZone),
    discount: {
      kind: draft.discountKind,
      value: draft.discountKind === 'percent' ? Number(draft.percent || 0) : (draft.fixedCents ?? 0),
      maxDiscountCents: draft.maxDiscountCents,
      minSubtotalCents: draft.minSubtotalCents,
    },
    codeMode: draft.codeMode,
    fixedCode: draft.codeMode === 'fixed' && draft.fixedCode.trim() ? draft.fixedCode : null,
    codePrefix: draft.codePrefix.trim() ? draft.codePrefix : null,
    usageLimitTotal: limitValue(draft.usageLimitTotal),
    usageLimitPerCustomer: limitValue(draft.usageLimitPerCustomer),
    usageLimitPerCode: limitValue(draft.usageLimitPerCode),
    scope: scopeOf(draft),
    isAutomatic: draft.isAutomatic,
    leadCapture: { enabled: draft.leadCaptureEnabled, fields: draft.leadFields, consentText: draft.consentText },
    leadTag: draft.leadTag.trim() || null,
  }
}

/** Corpo do PATCH: tudo menos o modo de código, que não muda depois de criada. */
export function draftToUpdate(draft: CampaignDraft, timeZone?: string): Omit<CreateCampaignInput, 'codeMode'> {
  const input: Partial<CreateCampaignInput> = { ...draftToInput(draft, timeZone) }
  delete input.codeMode
  return input as Omit<CreateCampaignInput, 'codeMode'>
}

/** Todos os campos recusados, sem repetir campo, com o caminho da API (`discount.value`). */
export function validateDraft(draft: CampaignDraft, isNew: boolean, timeZone?: string): FieldIssue[] {
  const input = draftToInput(draft, timeZone)
  const parsed = isNew
    ? createCampaignSchema.safeParse(input)
    : updateCampaignSchema.safeParse(draftToUpdate(draft, timeZone))
  const issues: FieldIssue[] = parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
  if (!isNew && parsed.success) {
    issues.push(
      ...checkCampaignRules({
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        codeMode: draft.codeMode,
        isAutomatic: draft.isAutomatic,
        leadCapture: {
          enabled: draft.leadCaptureEnabled,
          fields: draft.leadFields,
          consentText: draft.consentText.trim(),
        },
      }),
    )
  }
  const seen = new Set<string>()
  return issues.filter((issue) => (seen.has(issue.field) ? false : (seen.add(issue.field), true)))
}

export function isDraftDirty(draft: CampaignDraft, original: CampaignDraft): boolean {
  return JSON.stringify(draft) !== JSON.stringify(original)
}
