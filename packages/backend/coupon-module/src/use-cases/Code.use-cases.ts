/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  CampaignNotFoundError,
  CODE_MODE,
  CouponCodeNotFoundError,
  generateCouponCode,
  WrongCodeModeError,
  type Coupon,
  type CouponStatus,
  type ListCouponsQuery,
  type Paginated,
} from '@adatechnology/coupon-contracts'

import type { NewCouponRow } from '../schema/schema'
import { paginate, toCoupon } from '../shared/toContract'
import type { CampaignReference } from './Campaign.use-cases'
import type { CouponDependencies } from './couponModule.types'

// Colisão com 8 caracteres de 32 é rara; rodadas extras cobrem o azar sem laço infinito.
const GENERATION_ROUNDS = 5

export type GenerateCodesResult = { readonly generated: number; readonly prefix: string | null }

/** Gera `count` códigos únicos para uma campanha em lote. Colisão sai na próxima rodada. */
export class GenerateCodesUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(
    params: CampaignReference & { readonly count: number; readonly prefix?: string | undefined },
  ): Promise<GenerateCodesResult> {
    const { persistence, randomInt } = this.dependencies
    const campaign = await persistence.campaigns.findById(params)
    if (!campaign) throw new CampaignNotFoundError(params.id)
    if (campaign.codeMode !== CODE_MODE.BATCH) throw new WrongCodeModeError(CODE_MODE.BATCH)
    const prefix = params.prefix || campaign.codePrefix || null

    let generated = 0
    for (let round = 0; round < GENERATION_ROUNDS && generated < params.count; round += 1) {
      const wanted = params.count - generated
      const codes = new Set<string>()
      while (codes.size < wanted) codes.add(generateCouponCode({ prefix, randomInt }))
      const values: NewCouponRow[] = [...codes].map((code) => ({
        companyId: params.companyId,
        campaignId: params.id,
        code,
      }))
      generated += (await persistence.coupons.insertMany(values)).length
    }
    this.dependencies.logger?.info('coupons: lote gerado', { campaignId: params.id, generated })
    return { generated, prefix }
  }
}

export class ListCouponsUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(
    params: ListCouponsQuery & { readonly companyId: string; readonly campaignId: string },
  ): Promise<Paginated<Coupon>> {
    const { persistence } = this.dependencies
    if (!(await persistence.campaigns.findById({ companyId: params.companyId, id: params.campaignId })))
      throw new CampaignNotFoundError(params.campaignId)
    const page = await persistence.coupons.list(params)
    return paginate({ data: page.rows.map(toCoupon), total: page.total, page: params.page, pageSize: params.pageSize })
  }
}

/** Desativar um código vazado sem derrubar a campanha inteira. */
export class SetCouponStatusUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(
    params: CampaignReference & { readonly campaignId: string; readonly status: CouponStatus },
  ): Promise<Coupon> {
    const row = await this.dependencies.persistence.coupons.setStatus(params)
    if (!row) throw new CouponCodeNotFoundError(params.id)
    return toCoupon(row)
  }
}
