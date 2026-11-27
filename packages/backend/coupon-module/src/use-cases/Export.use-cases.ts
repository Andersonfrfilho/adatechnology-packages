/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Exportação de todos os resultados do filtro atual (leads, resgates, códigos) em CSV ou XLSX. Lê
 * em páginas e para no teto `COUPON_LIMITS.EXPORT_ROWS`; grava a trilha pelo gancho `onExported`.
 */

import {
  buildCsv,
  buildXlsx,
  CampaignNotFoundError,
  COUPON_LIMITS,
  CSV_CONTENT_TYPE,
  EXPORT_FORMAT,
  EXPORT_KIND,
  XLSX_CONTENT_TYPE,
  type ExportFormat,
  type ExportKind,
  type ListCouponsQuery,
  type ListLeadsQuery,
  type ListRedemptionsQuery,
  type SpreadsheetCell,
  type SpreadsheetTable,
} from '@adatechnology/coupon-contracts'

import type { CouponRow, LeadRow, RedemptionRow } from '../schema/schema'
import { runHook } from '../shared/runHook'
import type { CouponDependencies, Page } from './couponModule.types'

const EXPORT_PAGE_SIZE = 1000

export const EXPORT_HEADERS = {
  leads: ['Data', 'Nome', 'Telefone', 'E-mail', 'Cupom', 'Cliente'],
  redemptions: [
    'Data',
    'Situação',
    'Cupom',
    'Tipo do pedido',
    'Pedido',
    'Cliente',
    'Subtotal (R$)',
    'Desconto (R$)',
    'Liberado em',
  ],
  coupons: ['Código', 'Situação', 'Usos', 'Lead', 'Criado em'],
} as const

const reais = (cents: number): number => Math.round(cents) / 100
const isoOrNull = (value: Date | null): string | null => (value ? value.toISOString() : null)

const leadRow = (row: LeadRow): SpreadsheetCell[] => [
  row.createdAt.toISOString(),
  row.name,
  row.phone,
  row.email,
  row.couponCode,
  row.customerRef,
]
const redemptionRow = (row: RedemptionRow): SpreadsheetCell[] => [
  row.redeemedAt.toISOString(),
  row.status,
  row.couponCode,
  row.orderKind,
  row.orderId,
  row.customerRef,
  reais(row.subtotalCents),
  reais(row.discountCents),
  isoOrNull(row.releasedAt),
]
const couponRow = (row: CouponRow): SpreadsheetCell[] => [
  row.code,
  row.status,
  row.usedCount,
  row.leadId,
  row.createdAt.toISOString(),
]

export type ExportFilters =
  | { readonly kind: 'leads'; readonly query: Omit<ListLeadsQuery, 'page' | 'pageSize'> }
  | { readonly kind: 'redemptions'; readonly query: Omit<ListRedemptionsQuery, 'page' | 'pageSize'> }
  | { readonly kind: 'coupons'; readonly query: Omit<ListCouponsQuery, 'page' | 'pageSize'> }

export type ExportParams = {
  readonly companyId: string
  readonly campaignId: string
  readonly userId: string | undefined
  readonly format: ExportFormat
  readonly filters: ExportFilters
}

export type ExportResult = {
  readonly fileName: string
  readonly contentType: string
  readonly body: string | Uint8Array
  readonly rowCount: number
  /** `true` quando o teto cortou linhas: a tela avisa para filtrar mais. */
  readonly isTruncated: boolean
}

async function collect<TRow>(params: {
  readonly fetchPage: (page: number) => Promise<Page<TRow>>
  readonly toCells: (row: TRow) => SpreadsheetCell[]
}): Promise<{ rows: SpreadsheetCell[][]; total: number }> {
  const rows: SpreadsheetCell[][] = []
  let total = 0
  // Sequencial de propósito: cada página depende de saber se a anterior já bateu no teto.
  for (let page = 1; rows.length < COUPON_LIMITS.EXPORT_ROWS; page += 1) {
    const result = await params.fetchPage(page)
    total = result.total
    rows.push(...result.rows.map(params.toCells))
    if (result.rows.length < EXPORT_PAGE_SIZE) break
  }
  return { rows: rows.slice(0, COUPON_LIMITS.EXPORT_ROWS), total }
}

export class ExportCampaignDataUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: ExportParams): Promise<ExportResult> {
    const { persistence } = this.dependencies
    if (!(await persistence.campaigns.findById({ companyId: params.companyId, id: params.campaignId })))
      throw new CampaignNotFoundError(params.campaignId)
    const { rows, total } = await this.collectRows(params)
    const table: SpreadsheetTable = { header: EXPORT_HEADERS[params.filters.kind], rows }
    const stamp = this.dependencies.clock.now().toISOString().slice(0, 10)
    const fileName = `${params.filters.kind}-${stamp}.${params.format}`
    const body =
      params.format === EXPORT_FORMAT.XLSX ? buildXlsx({ table, sheetName: params.filters.kind }) : buildCsv(table)
    await this.audit(params, rows.length)
    return {
      fileName,
      contentType: params.format === EXPORT_FORMAT.XLSX ? XLSX_CONTENT_TYPE : CSV_CONTENT_TYPE,
      body,
      rowCount: rows.length,
      isTruncated: total > rows.length,
    }
  }

  private collectRows(params: ExportParams): Promise<{ rows: SpreadsheetCell[][]; total: number }> {
    const { persistence } = this.dependencies
    const scope = { companyId: params.companyId, campaignId: params.campaignId, pageSize: EXPORT_PAGE_SIZE }
    const { filters } = params
    if (filters.kind === EXPORT_KIND.LEADS)
      return collect({
        fetchPage: (page) => persistence.leads.list({ ...filters.query, ...scope, page }),
        toCells: leadRow,
      })
    if (filters.kind === EXPORT_KIND.REDEMPTIONS)
      return collect({
        fetchPage: (page) => persistence.redemptions.list({ ...filters.query, ...scope, page }),
        toCells: redemptionRow,
      })
    return collect({
      fetchPage: (page) => persistence.coupons.list({ ...filters.query, ...scope, page }),
      toCells: couponRow,
    })
  }

  private async audit(params: ExportParams, rowCount: number): Promise<void> {
    const hook = this.dependencies.hooks?.onExported
    const kind: ExportKind = params.filters.kind
    this.dependencies.logger?.info('coupons: exportação', {
      campaignId: params.campaignId,
      kind,
      format: params.format,
      rowCount,
    })
    if (!hook) return
    await runHook({
      name: 'onExported',
      logger: this.dependencies.logger,
      meta: { campaignId: params.campaignId },
      run: () =>
        hook({
          companyId: params.companyId,
          userId: params.userId,
          campaignId: params.campaignId,
          kind,
          format: params.format,
          filters: params.filters.query,
          rowCount,
        }),
    })
  }
}
