/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O pacote não faz `fetch`: o host implementa estas interfaces (sobre as rotas do `coupon-module`,
 * um BFF, ou o que tiver) e injeta no `CouponsProvider`. Método ausente = recurso ausente na tela.
 */

import type {
  Campaign,
  CampaignListItem,
  CampaignReport,
  CampaignState,
  CaptureLeadInput,
  CaptureLeadResult,
  CartItem,
  Coupon,
  CouponStatus,
  CouponValidation,
  CreateCampaignInput,
  ExportFormat,
  ExportKind,
  Lead,
  Paginated,
  PublicCampaign,
  Redemption,
  RedemptionStatus,
  UpdateCampaignInput,
} from '@adatechnology/coupon-contracts'
import type { ReactNode } from 'react'

export type SortOrder = 'asc' | 'desc'

export type ListCampaignsParams = {
  readonly page: number
  readonly pageSize: number
  readonly search?: string
  /** Seleção múltipla. */
  readonly states?: readonly CampaignState[]
  readonly sort?: 'createdAt' | 'updatedAt' | 'name' | 'startsAt' | 'endsAt'
  readonly order?: SortOrder
}

export type ListRecordsParams = {
  readonly page: number
  readonly pageSize: number
  readonly search?: string
  readonly order?: SortOrder
  /** Só em usos: `redeemed`, `released`. */
  readonly statuses?: readonly RedemptionStatus[]
  /** Só em códigos: os ainda não entregues a ninguém. */
  readonly unassigned?: boolean
  /** Só em contatos: período da captação, meio aberto (`from <= capturado < to`), instantes ISO. */
  readonly from?: string
  readonly to?: string
}

export type ExportRequest = {
  readonly campaignId: string
  readonly kind: ExportKind
  readonly format: ExportFormat
  /** Os mesmos filtros da tela (busca, situação, ordem), sem página. */
  readonly filters: Omit<ListRecordsParams, 'page' | 'pageSize'>
}

export type GenerateCodesResult = { readonly generated: number; readonly prefix: string | null }

export type CouponsAdminApi = {
  listCampaigns(params: ListCampaignsParams): Promise<Paginated<CampaignListItem>>
  getCampaign(id: string): Promise<Campaign>
  createCampaign(input: CreateCampaignInput): Promise<Campaign>
  updateCampaign(id: string, input: UpdateCampaignInput): Promise<Campaign>
  /** Ausente: sem "Excluir" (o caminho é desativar). */
  removeCampaign?(id: string): Promise<void>
  /** Ausente: sem a aba de relatório. */
  getReport?(id: string): Promise<CampaignReport>
  /** Ausente: sem a aba de códigos. */
  listCoupons?(campaignId: string, params: ListRecordsParams): Promise<Paginated<Coupon>>
  generateCodes?(
    campaignId: string,
    input: { readonly count: number; readonly prefix?: string },
  ): Promise<GenerateCodesResult>
  setCouponStatus?(campaignId: string, couponId: string, status: CouponStatus): Promise<Coupon>
  /** Ausente: sem a aba de contatos. */
  listLeads?(campaignId: string, params: ListRecordsParams): Promise<Paginated<Lead>>
  /** Ausente: sem a aba de usos. */
  listRedemptions?(campaignId: string, params: ListRecordsParams): Promise<Paginated<Redemption>>
  /** Arquivo de todos os resultados do filtro, gerado no servidor. Ausente: só "página atual". */
  exportRecords?(request: ExportRequest): Promise<Blob>
}

export type CouponsPublicApi = {
  /** Campanhas no ar, para o banner. */
  listOpenCampaigns?(): Promise<readonly PublicCampaign[]>
  /** Prévia do desconto do código para o carrinho. */
  previewCoupon?(input: { readonly code: string; readonly items: readonly CartItem[] }): Promise<CouponValidation>
  /** Deixa o contato e recebe o código. */
  captureLead?(campaignId: string, input: CaptureLeadInput): Promise<CaptureLeadResult>
}

export type SelectOption = { readonly id: string; readonly label: string }

export type SelectInputProps = {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly options: readonly SelectOption[]
  readonly onChange: (value: string) => void
}

/** Troca o `<select>` nativo pelo menu de seleção do design system do host. */
export type RenderSelect = (props: SelectInputProps) => ReactNode

export type DateTimeInputProps = {
  readonly id: string
  readonly label: string
  /** `YYYY-MM-DDTHH:mm` (hora local, 24h), ou vazio. */
  readonly value: string
  readonly onChange: (value: string) => void
}

/** Troca o `<input type="datetime-local">` nativo pelo seletor de data e hora do host. */
export type RenderDateTimeInput = (props: DateTimeInputProps) => ReactNode

export type DateRangeValue = {
  /** `YYYY-MM-DD` (dia no fuso da empresa), ou vazio. Os dois limites são dias inteiros, inclusive. */
  readonly from: string
  readonly to: string
}

export type DateRangeInputProps = {
  readonly id: string
  readonly label: string
  readonly value: DateRangeValue
  readonly onChange: (value: DateRangeValue) => void
}

/** Troca o filtro de período padrão (dois campos de data com máscara) pelo seletor de intervalo do host. */
export type RenderDateRangeInput = (props: DateRangeInputProps) => ReactNode
