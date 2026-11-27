/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type {
  CampaignStats,
  ClockPort,
  CouponHooks,
  CouponModuleConfig,
  CouponStatus,
  CustomerIdentityPort,
  LeadNotifierPort,
  ListCampaignsQuery,
  ListCouponsQuery,
  ListLeadsQuery,
  ListRedemptionsQuery,
  LoggerPort,
  RandomIntSource,
} from '@adatechnology/coupon-contracts'

import type {
  CampaignRow,
  CouponRow,
  LeadRow,
  NewCampaignRow,
  NewCouponRow,
  NewLeadRow,
  NewRedemptionRow,
  RedemptionRow,
} from '../schema/schema'

export type Page<TRow> = { readonly rows: readonly TRow[]; readonly total: number }

type Owned = { readonly companyId: string; readonly id: string }
type InCampaign = { readonly companyId: string; readonly campaignId: string }

/**
 * Persistência, por tabela. Toda operação recebe `companyId` — não existe leitura sem empresa
 * (`repositories/conditions.ts` e `isolation.test.ts` provam isso no SQL).
 */
export interface CampaignStorePort {
  create(values: NewCampaignRow): Promise<CampaignRow>
  findById(params: Owned): Promise<CampaignRow | undefined>
  /** Trava a linha (`FOR UPDATE`) até o fim da transação: serializa resgates da mesma campanha. */
  lockById(params: Owned): Promise<CampaignRow | undefined>
  update(params: Owned & { readonly values: Partial<NewCampaignRow> }): Promise<CampaignRow | undefined>
  remove(params: Owned): Promise<boolean>
  list(params: ListCampaignsQuery & { readonly companyId: string; readonly now: Date }): Promise<Page<CampaignRow>>
  stats(params: {
    readonly companyId: string
    readonly campaignIds: readonly string[]
  }): Promise<ReadonlyMap<string, CampaignStats>>
  /** Automáticas ligadas e dentro do período. */
  listOpenAutomatic(params: { readonly companyId: string; readonly now: Date }): Promise<readonly CampaignRow[]>
  /** Ligadas e dentro do período, para o banner do site. */
  listOpen(params: { readonly companyId: string; readonly now: Date }): Promise<readonly CampaignRow[]>
  hasActivity(params: Owned): Promise<boolean>
}

export interface CouponCodeStorePort {
  /** Insere ignorando colisão de código; devolve só o que entrou. */
  insertMany(values: readonly NewCouponRow[]): Promise<readonly CouponRow[]>
  findByCode(params: { readonly companyId: string; readonly code: string }): Promise<CouponRow | undefined>
  findFixed(params: InCampaign): Promise<CouponRow | undefined>
  updateCode(params: Owned & { readonly code: string }): Promise<CouponRow | undefined>
  setStatus(params: Owned & { readonly status: CouponStatus }): Promise<CouponRow | undefined>
  /** Pega um código livre do lote (`FOR UPDATE SKIP LOCKED`) e o entrega ao lead. */
  claimUnassigned(params: InCampaign & { readonly leadId: string }): Promise<CouponRow | undefined>
  adjustUsedCount(params: { readonly companyId: string; readonly code: string; readonly delta: number }): Promise<void>
  list(params: ListCouponsQuery & InCampaign): Promise<Page<CouponRow>>
  count(params: InCampaign): Promise<{ readonly total: number; readonly used: number }>
}

export interface LeadStorePort {
  /** `undefined` quando o telefone ou o e-mail já está na campanha (índice único). */
  insert(values: NewLeadRow): Promise<LeadRow | undefined>
  findByContact(
    params: InCampaign & { readonly phone: string | null; readonly email: string | null },
  ): Promise<LeadRow | undefined>
  update(params: Owned & { readonly values: Partial<NewLeadRow> }): Promise<LeadRow | undefined>
  list(params: ListLeadsQuery & InCampaign): Promise<Page<LeadRow>>
  count(params: InCampaign): Promise<number>
}

export type RedemptionTotals = {
  readonly redeemed: number
  readonly released: number
  readonly discountCents: number
  readonly subtotalCents: number
}

export interface RedemptionStorePort {
  findByOrder(params: {
    readonly companyId: string
    readonly orderKind: string
    readonly orderId: string
  }): Promise<RedemptionRow | undefined>
  /** Usos ativos (`redeemed`). Chamado dentro da transação, com a campanha travada. */
  usage(params: InCampaign & { readonly code: string | null; readonly customerRef: string | null }): Promise<{
    readonly totalUsed: number
    readonly codeUsed: number
    readonly customerUsed: number
  }>
  insert(values: NewRedemptionRow): Promise<RedemptionRow>
  update(params: Owned & { readonly values: Partial<NewRedemptionRow> }): Promise<RedemptionRow | undefined>
  list(params: ListRedemptionsQuery & InCampaign): Promise<Page<RedemptionRow>>
  totals(params: InCampaign): Promise<RedemptionTotals>
}

export type CouponStores = {
  readonly campaigns: CampaignStorePort
  readonly coupons: CouponCodeStorePort
  readonly leads: LeadStorePort
  readonly redemptions: RedemptionStorePort
}

/** As lojas mais uma unidade de trabalho: tudo dentro de `transaction` confirma junto ou nada. */
export type CouponPersistence = CouponStores & {
  transaction<TResult>(work: (stores: CouponStores) => Promise<TResult>): Promise<TResult>
}

export type CouponDependencies = {
  readonly persistence: CouponPersistence
  readonly config: CouponModuleConfig
  readonly clock: ClockPort
  readonly randomInt: RandomIntSource
  readonly hooks?: CouponHooks
  readonly leadNotifier?: LeadNotifierPort
  readonly customerIdentity?: CustomerIdentityPort
  readonly logger?: LoggerPort
}
