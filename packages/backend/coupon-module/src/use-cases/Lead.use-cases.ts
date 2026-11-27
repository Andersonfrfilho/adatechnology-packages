/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Captação: a pessoa deixa o contato e recebe o código. Deduplicada por telefone e e-mail canônicos
 * (o índice único fecha a corrida); repetir o cadastro não cria lead nem código novo.
 */

import {
  CampaignNotFoundError,
  CampaignUnavailableError,
  CAPTURE_OUTCOME,
  canonicalEmail,
  canonicalPhone,
  CODE_MODE,
  CodesExhaustedError,
  ConsentRequiredError,
  LeadNotFoundError,
  RateLimitedError,
  COUPON_LIMITS,
  DEFAULT_PHONE_COUNTRY_CODE,
  FIELD_REQUIREMENT,
  generateCouponCode,
  InvalidLeadError,
  isCampaignOpen,
  type CaptureLeadResult,
  type FieldRequirement,
  type Lead,
  type LeadContact,
  type LeadFieldIssue,
  type ListLeadsQuery,
  type Paginated,
} from '@adatechnology/coupon-contracts'

import type { CampaignRow, LeadRow } from '../schema/schema'
import { runHook } from '../shared/runHook'
import { paginate, toCampaign, toLead, toPublicCampaign } from '../shared/toContract'
import type { CouponDependencies, CouponStores } from './couponModule.types'

const PER_LEAD_ATTEMPTS = 5

export type CaptureLeadParams = {
  readonly companyId: string
  readonly campaignId: string
  readonly input: {
    readonly name?: string | undefined
    readonly phone?: string | undefined
    readonly email?: string | undefined
    readonly consent: boolean
  }
}

type FieldCheck = { readonly value: string | null; readonly issue?: LeadFieldIssue }

function checkField(params: {
  readonly field: string
  readonly raw: string | undefined
  readonly requirement: FieldRequirement
  readonly canonical: (raw: string) => string | undefined
}): FieldCheck {
  const raw = params.raw?.trim() ?? ''
  if (params.requirement === FIELD_REQUIREMENT.OFF) return { value: null }
  if (raw === '') {
    return params.requirement === FIELD_REQUIREMENT.REQUIRED
      ? { value: null, issue: { field: params.field, message: 'Campo obrigatório.' } }
      : { value: null }
  }
  const value = params.canonical(raw)
  return value === undefined ? { value: null, issue: { field: params.field, message: 'Valor inválido.' } } : { value }
}

function readContact(campaign: CampaignRow, input: CaptureLeadParams['input'], countryCode: string): LeadContact {
  const { fields } = campaign.leadCapture
  const checks = {
    name: checkField({
      field: 'name',
      raw: input.name,
      requirement: fields.name,
      canonical: (raw) => raw.slice(0, COUPON_LIMITS.LEAD_NAME),
    }),
    phone: checkField({
      field: 'phone',
      raw: input.phone,
      requirement: fields.phone,
      canonical: (raw) => canonicalPhone(raw, countryCode),
    }),
    email: checkField({ field: 'email', raw: input.email, requirement: fields.email, canonical: canonicalEmail }),
  }
  const issues = Object.values(checks).flatMap((check) => (check.issue ? [check.issue] : []))
  if (issues.length > 0) throw new InvalidLeadError(issues)
  if (!checks.phone.value && !checks.email.value)
    throw new InvalidLeadError([{ field: 'phone', message: 'Informe telefone ou e-mail.' }])
  return { name: checks.name.value, phone: checks.phone.value, email: checks.email.value }
}

/** Mesmo telefone E mesmo e-mail (canônicos) que o lead guardado; campo não pedido conta como igual. */
function isSameContact(lead: LeadRow, contact: LeadContact): boolean {
  return (lead.phone ?? null) === (contact.phone ?? null) && (lead.email ?? null) === (contact.email ?? null)
}

type Captured = { readonly lead: LeadRow; readonly isNew: boolean }

export class CaptureLeadUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: CaptureLeadParams): Promise<CaptureLeadResult> {
    const { persistence, clock } = this.dependencies
    const campaign = await persistence.campaigns.findById({ companyId: params.companyId, id: params.campaignId })
    if (!campaign || !campaign.leadCapture.enabled || !isCampaignOpen(toCampaign(campaign), clock.now()))
      throw new CampaignUnavailableError()
    if (!params.input.consent) throw new ConsentRequiredError()
    const contact = readContact(
      campaign,
      params.input,
      this.dependencies.config.phoneCountryCode ?? DEFAULT_PHONE_COUNTRY_CODE,
    )

    if (campaign.codeMode === CODE_MODE.FIXED && !campaign.fixedCode) throw new CampaignUnavailableError()

    const captured = await persistence.transaction((stores) => this.capture(stores, campaign, contact))
    const { codeResent } = await this.afterCapture({ campaign, contact, captured })
    const isPublicCode = campaign.codeMode === CODE_MODE.FIXED
    return {
      leadId: captured.lead.id,
      outcome: captured.isNew ? CAPTURE_OUTCOME.CREATED : CAPTURE_OUTCOME.ALREADY_REGISTERED,
      isNew: captured.isNew,
      codeResent,
      couponCode: captured.isNew || isPublicCode ? captured.lead.couponCode : null,
      discount: toPublicCampaign(campaign).discount,
      endsAt: campaign.endsAt ? campaign.endsAt.toISOString() : null,
    }
  }

  private async capture(stores: CouponStores, campaign: CampaignRow, contact: LeadContact): Promise<Captured> {
    const scope = { companyId: campaign.companyId, campaignId: campaign.id }
    // Trava a campanha: captações simultâneas da mesma campanha entram uma a uma (teto diário exato).
    const locked = await stores.campaigns.lockById({ companyId: campaign.companyId, id: campaign.id })
    if (!locked) throw new CampaignUnavailableError()
    const existing = await stores.leads.findByContact({ ...scope, phone: contact.phone, email: contact.email })
    if (existing) return { lead: existing, isNew: false }
    const now = this.dependencies.clock.now()
    await this.assertDailyCap(stores, campaign, now)
    const inserted = await stores.leads.insert({
      ...scope,
      ...contact,
      consentText: campaign.leadCapture.consentText,
      consentedAt: now,
      createdAt: now,
    })
    if (!inserted) {
      const raced = await stores.leads.findByContact({ ...scope, phone: contact.phone, email: contact.email })
      if (!raced) throw new CampaignNotFoundError(campaign.id)
      return { lead: raced, isNew: false }
    }
    const code = await this.issueCode(stores, campaign, inserted.id)
    const lead = await stores.leads.update({
      companyId: campaign.companyId,
      id: inserted.id,
      values: { couponCode: code },
    })
    return { lead: lead ?? inserted, isNew: true }
  }

  private async assertDailyCap(stores: CouponStores, campaign: CampaignRow, now: Date): Promise<void> {
    const cap = this.dependencies.config.maxLeadsPerCampaignPerDay
    if (cap === undefined) return
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const today = await stores.leads.countSince({ companyId: campaign.companyId, campaignId: campaign.id, since })
    if (today >= cap) throw new RateLimitedError(undefined)
  }

  private async issueCode(stores: CouponStores, campaign: CampaignRow, leadId: string): Promise<string> {
    const scope = { companyId: campaign.companyId, campaignId: campaign.id }
    if (campaign.codeMode === CODE_MODE.FIXED) {
      if (!campaign.fixedCode) throw new CampaignUnavailableError()
      return campaign.fixedCode
    }
    if (campaign.codeMode === CODE_MODE.BATCH) {
      const claimed = await stores.coupons.claimUnassigned({ ...scope, leadId })
      if (!claimed) throw new CodesExhaustedError(campaign.id)
      return claimed.code
    }
    for (let attempt = 0; attempt < PER_LEAD_ATTEMPTS; attempt += 1) {
      const code = generateCouponCode({ prefix: campaign.codePrefix, randomInt: this.dependencies.randomInt })
      const [row] = await stores.coupons.insertMany([{ ...scope, code, leadId }])
      if (row) return row.code
    }
    throw new CodesExhaustedError(campaign.id)
  }

  /** Depois do commit: cliente do host, envio do código, gancho. Cada um isolado; nenhum desfaz o cadastro. */
  private async afterCapture(params: {
    campaign: CampaignRow
    contact: LeadContact
    captured: Captured
  }): Promise<{ codeResent: boolean }> {
    const { campaign, contact, captured } = params
    const { customerIdentity, leadNotifier, hooks, logger, persistence } = this.dependencies
    const meta = { campaignId: campaign.id, leadId: captured.lead.id }
    let lead = captured.lead
    if (captured.isNew && customerIdentity) {
      await runHook({
        name: 'customerIdentity.resolve',
        logger,
        meta,
        run: async () => {
          const customerRef = await customerIdentity.resolve({ companyId: campaign.companyId, contact })
          if (!customerRef) return
          lead =
            (await persistence.leads.update({ companyId: campaign.companyId, id: lead.id, values: { customerRef } })) ??
            lead
        },
      })
    }
    const code = lead.couponCode
    // Repetição só reenvia se o contato informado é exatamente o guardado; e o envio vai sempre para o
    // contato GUARDADO. Telefone de um com e-mail de outro não desvia o código de ninguém.
    const isResendAllowed = captured.isNew || isSameContact(lead, contact)
    let codeResent = false
    if (leadNotifier && code && isResendAllowed) {
      const storedContact: LeadContact = { name: lead.name, phone: lead.phone, email: lead.email }
      await runHook({
        name: 'leadNotifier.sendCoupon',
        logger,
        meta,
        run: async () => {
          await leadNotifier.sendCoupon({
            companyId: campaign.companyId,
            leadId: lead.id,
            contact: storedContact,
            campaign: toPublicCampaign(campaign),
            code,
            isResend: !captured.isNew,
          })
          codeResent = true
        },
      })
    }
    const hook = hooks?.onLeadCaptured
    if (captured.isNew && hook) {
      const event = { lead: toLead(lead), campaign: toCampaign(campaign), leadTag: campaign.leadTag }
      await runHook({ name: 'onLeadCaptured', logger, meta, run: () => hook(event) })
    }
    logger?.info('coupons: lead captado', { ...meta, isNew: captured.isNew, codeResent })
    return { codeResent }
  }
}

export class ListLeadsUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(
    params: ListLeadsQuery & { readonly companyId: string; readonly campaignId: string },
  ): Promise<Paginated<Lead>> {
    const page = await this.dependencies.persistence.leads.list(params)
    return paginate({ data: page.rows.map(toLead), total: page.total, page: params.page, pageSize: params.pageSize })
  }
}

/**
 * LGPD: apaga os dados pessoais do contato (nome, telefone, e-mail, cliente, código entregue) e
 * mantém a linha anonimizada, para os totais da campanha não mudarem.
 */
export class AnonymiseLeadUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: {
    readonly companyId: string
    readonly campaignId: string
    readonly leadId: string
  }): Promise<void> {
    const row = await this.dependencies.persistence.leads.anonymise(params)
    if (!row) throw new LeadNotFoundError(params.leadId)
    this.dependencies.logger?.info('coupons: lead anonimizado', {
      campaignId: params.campaignId,
      leadId: params.leadId,
    })
  }
}
