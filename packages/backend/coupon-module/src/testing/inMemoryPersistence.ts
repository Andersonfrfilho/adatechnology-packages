/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublê em memória da persistência inteira: mesmas regras de escopo por empresa, unicidade e
 * transação (fila única + desfazer em erro). Serve aos testes do pacote e aos do host.
 */

import { randomUUID } from 'node:crypto'

import { campaignState, REDEMPTION_STATUS, type CampaignStats } from '@adatechnology/coupon-contracts'

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
import { toCampaign } from '../shared/toContract'
import type { CouponPersistence, CouponStores, Page } from '../use-cases/couponModule.types'

export type InMemoryState = {
  campaigns: CampaignRow[]
  coupons: CouponRow[]
  leads: LeadRow[]
  redemptions: RedemptionRow[]
}

function pageOf<TRow>(rows: readonly TRow[], page: number, pageSize: number): Page<TRow> {
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length }
}

function compare(left: unknown, right: unknown): number {
  const normalize = (value: unknown) => (value instanceof Date ? value.getTime() : (value ?? ''))
  const [a, b] = [normalize(left), normalize(right)]
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function sortBy<TRow>(rows: TRow[], key: keyof TRow, order: 'asc' | 'desc'): TRow[] {
  return rows.sort((left, right) => (order === 'asc' ? 1 : -1) * compare(left[key], right[key]))
}

const contains = (value: string | null, search: string) => (value ?? '').toLowerCase().includes(search.toLowerCase())

function buildStores(state: InMemoryState): CouponStores {
  const ownedCampaign = (companyId: string, id: string) =>
    state.campaigns.find((row) => row.companyId === companyId && row.id === id)
  const redeemed = (campaignId: string) =>
    state.redemptions.filter((row) => row.campaignId === campaignId && row.status === REDEMPTION_STATUS.REDEEMED)

  return {
    campaigns: {
      async create(values: NewCampaignRow) {
        const now = new Date()
        const row = {
          id: randomUUID(),
          title: '',
          text: '',
          terms: '',
          isActive: false,
          startsAt: null,
          endsAt: null,
          maxDiscountCents: null,
          minSubtotalCents: null,
          fixedCode: null,
          codePrefix: null,
          usageLimitTotal: null,
          usageLimitPerCustomer: null,
          usageLimitPerCode: null,
          scope: { kind: 'all' },
          isAutomatic: false,
          createdAt: now,
          updatedAt: now,
          ...values,
        } as CampaignRow
        state.campaigns.push(row)
        return { ...row }
      },
      async findById({ companyId, id }) {
        const row = ownedCampaign(companyId, id)
        return row ? { ...row } : undefined
      },
      async lockById({ companyId, id }) {
        const row = ownedCampaign(companyId, id)
        return row ? { ...row } : undefined
      },
      async update({ companyId, id, values }) {
        const row = ownedCampaign(companyId, id)
        if (!row) return undefined
        Object.assign(row, values)
        return { ...row }
      },
      async remove({ companyId, id }) {
        const before = state.campaigns.length
        state.campaigns = state.campaigns.filter((row) => !(row.companyId === companyId && row.id === id))
        state.coupons = state.coupons.filter((row) => row.campaignId !== id)
        state.leads = state.leads.filter((row) => row.campaignId !== id)
        return state.campaigns.length < before
      },
      async list(query) {
        let rows = state.campaigns.filter((row) => row.companyId === query.companyId)
        if (query.search)
          rows = rows.filter(
            (row) =>
              contains(row.name, query.search ?? '') ||
              contains(row.title, query.search ?? '') ||
              contains(row.fixedCode, query.search ?? ''),
          )
        if (query.state) rows = rows.filter((row) => query.state?.includes(campaignState(toCampaign(row), query.now)))
        return pageOf(
          sortBy([...rows], query.sort, query.order).map((row) => ({ ...row })),
          query.page,
          query.pageSize,
        )
      },
      async stats({ companyId, campaignIds }) {
        const result = new Map<string, CampaignStats>()
        for (const campaignId of campaignIds) {
          const used = redeemed(campaignId).filter((row) => row.companyId === companyId)
          result.set(campaignId, {
            redemptionCount: used.length,
            discountCents: used.reduce((sum, row) => sum + row.discountCents, 0),
            leadCount: state.leads.filter((row) => row.companyId === companyId && row.campaignId === campaignId).length,
          })
        }
        return result
      },
      async listOpenAutomatic({ companyId, now }) {
        return state.campaigns.filter(
          (row) => row.companyId === companyId && row.isAutomatic && campaignState(toCampaign(row), now) === 'running',
        )
      },
      async listOpen({ companyId, now }) {
        return state.campaigns.filter(
          (row) => row.companyId === companyId && campaignState(toCampaign(row), now) === 'running',
        )
      },
      async hasActivity({ companyId, id }) {
        return (
          state.redemptions.some((row) => row.companyId === companyId && row.campaignId === id) ||
          state.leads.some((row) => row.companyId === companyId && row.campaignId === id)
        )
      },
    },
    coupons: {
      async insertMany(values: readonly NewCouponRow[]) {
        const inserted: CouponRow[] = []
        for (const value of values) {
          if (state.coupons.some((row) => row.companyId === value.companyId && row.code === value.code)) continue
          const row = {
            id: randomUUID(),
            leadId: null,
            usedCount: 0,
            status: 'active',
            createdAt: new Date(),
            ...value,
          } as CouponRow
          state.coupons.push(row)
          inserted.push({ ...row })
        }
        return inserted
      },
      async findByCode({ companyId, code }) {
        const row = state.coupons.find((item) => item.companyId === companyId && item.code === code)
        return row ? { ...row } : undefined
      },
      async findFixed({ companyId, campaignId }) {
        const row = state.coupons.find(
          (item) => item.companyId === companyId && item.campaignId === campaignId && item.leadId === null,
        )
        return row ? { ...row } : undefined
      },
      async updateCode({ companyId, id, code }) {
        const row = state.coupons.find((item) => item.companyId === companyId && item.id === id)
        if (!row) return undefined
        row.code = code
        return { ...row }
      },
      async setStatus({ companyId, id, status }) {
        const row = state.coupons.find((item) => item.companyId === companyId && item.id === id)
        if (!row) return undefined
        row.status = status
        return { ...row }
      },
      async claimUnassigned({ companyId, campaignId, leadId }) {
        const row = state.coupons.find(
          (item) =>
            item.companyId === companyId &&
            item.campaignId === campaignId &&
            item.leadId === null &&
            item.status === 'active',
        )
        if (!row) return undefined
        row.leadId = leadId
        return { ...row }
      },
      async adjustUsedCount({ companyId, code, delta }) {
        const row = state.coupons.find((item) => item.companyId === companyId && item.code === code)
        if (row) row.usedCount = Math.max(0, row.usedCount + delta)
      },
      async list(query) {
        let rows = state.coupons.filter(
          (row) => row.companyId === query.companyId && row.campaignId === query.campaignId,
        )
        if (query.search) rows = rows.filter((row) => contains(row.code, query.search ?? ''))
        if (query.unassigned) rows = rows.filter((row) => row.leadId === null)
        return pageOf(sortBy([...rows], 'createdAt', query.order), query.page, query.pageSize)
      },
      async count({ companyId, campaignId }) {
        const rows = state.coupons.filter((row) => row.companyId === companyId && row.campaignId === campaignId)
        return { total: rows.length, used: rows.filter((row) => row.usedCount > 0).length }
      },
    },
    leads: {
      async insert(values: NewLeadRow) {
        const clash = state.leads.some(
          (row) =>
            row.campaignId === values.campaignId &&
            ((values.phone && row.phone === values.phone) || (values.email && row.email === values.email)),
        )
        if (clash) return undefined
        const row = {
          id: randomUUID(),
          name: null,
          phone: null,
          email: null,
          customerRef: null,
          couponCode: null,
          createdAt: new Date(),
          ...values,
        } as LeadRow
        state.leads.push(row)
        return { ...row }
      },
      async findByContact({ companyId, campaignId, phone, email }) {
        const row = state.leads.find(
          (item) =>
            item.companyId === companyId &&
            item.campaignId === campaignId &&
            ((phone && item.phone === phone) || (email && item.email === email)),
        )
        return row ? { ...row } : undefined
      },
      async update({ companyId, id, values }) {
        const row = state.leads.find((item) => item.companyId === companyId && item.id === id)
        if (!row) return undefined
        Object.assign(row, values)
        return { ...row }
      },
      async list(query) {
        let rows = state.leads.filter((row) => row.companyId === query.companyId && row.campaignId === query.campaignId)
        const search = query.search
        if (search) {
          const digits = search.replace(/\D/g, '')
          rows = rows.filter(
            (row) =>
              contains(row.name, search) ||
              contains(row.email, search) ||
              (digits !== '' && (row.phone ?? '').includes(digits)),
          )
        }
        return pageOf(sortBy([...rows], query.sort, query.order), query.page, query.pageSize)
      },
      async count({ companyId, campaignId }) {
        return state.leads.filter((row) => row.companyId === companyId && row.campaignId === campaignId).length
      },
    },
    redemptions: {
      async findByOrder({ companyId, orderKind, orderId }) {
        const row = state.redemptions.find(
          (item) => item.companyId === companyId && item.orderKind === orderKind && item.orderId === orderId,
        )
        return row ? { ...row } : undefined
      },
      async usage({ companyId, campaignId, code, customerRef }) {
        const rows = redeemed(campaignId).filter((row) => row.companyId === companyId)
        return {
          totalUsed: rows.length,
          codeUsed: code === null ? 0 : rows.filter((row) => row.couponCode === code).length,
          customerUsed: customerRef === null ? 0 : rows.filter((row) => row.customerRef === customerRef).length,
        }
      },
      async insert(values: NewRedemptionRow) {
        if (
          state.redemptions.some(
            (row) =>
              row.companyId === values.companyId &&
              row.orderKind === values.orderKind &&
              row.orderId === values.orderId,
          )
        ) {
          throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })
        }
        const row = {
          id: randomUUID(),
          couponCode: null,
          customerRef: null,
          status: 'redeemed',
          releasedAt: null,
          ...values,
        } as RedemptionRow
        state.redemptions.push(row)
        return { ...row }
      },
      async update({ companyId, id, values }) {
        const row = state.redemptions.find((item) => item.companyId === companyId && item.id === id)
        if (!row) return undefined
        Object.assign(row, values)
        return { ...row }
      },
      async list(query) {
        let rows = state.redemptions.filter(
          (row) => row.companyId === query.companyId && row.campaignId === query.campaignId,
        )
        if (query.status) rows = rows.filter((row) => query.status?.includes(row.status as 'redeemed' | 'released'))
        if (query.search)
          rows = rows.filter(
            (row) => contains(row.couponCode, query.search ?? '') || contains(row.orderId, query.search ?? ''),
          )
        return pageOf(sortBy([...rows], query.sort, query.order), query.page, query.pageSize)
      },
      async totals({ companyId, campaignId }) {
        const rows = state.redemptions.filter((row) => row.companyId === companyId && row.campaignId === campaignId)
        const active = rows.filter((row) => row.status === REDEMPTION_STATUS.REDEEMED)
        return {
          redeemed: active.length,
          released: rows.length - active.length,
          discountCents: active.reduce((sum, row) => sum + row.discountCents, 0),
          subtotalCents: active.reduce((sum, row) => sum + row.subtotalCents, 0),
        }
      },
    },
  }
}

export function createInMemoryCouponPersistence(): CouponPersistence & { readonly state: InMemoryState } {
  const state: InMemoryState = { campaigns: [], coupons: [], leads: [], redemptions: [] }
  const stores = buildStores(state)
  let queue: Promise<unknown> = Promise.resolve()
  return {
    ...stores,
    state,
    transaction(work) {
      // Fila única: simula a trava de linha do Postgres; erro devolve o estado de antes.
      const run = queue.then(async () => {
        const snapshot = structuredClone(state)
        try {
          return await work(stores)
        } catch (error) {
          Object.assign(state, snapshot)
          throw error
        }
      })
      queue = run.catch(() => undefined)
      return run
    },
  }
}
