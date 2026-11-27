/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { CouponDatabase } from '../database.types'
import type { CouponPersistence, CouponStores } from '../use-cases/couponModule.types'
import { CampaignRepository } from './CampaignRepository'
import { CouponCodeRepository } from './CouponCodeRepository'
import { LeadRepository } from './LeadRepository'
import { RedemptionRepository } from './RedemptionRepository'

function buildStores(db: CouponDatabase): CouponStores {
  return {
    campaigns: new CampaignRepository(db),
    coupons: new CouponCodeRepository(db),
    leads: new LeadRepository(db),
    redemptions: new RedemptionRepository(db),
  }
}

/** Repositórios sobre a conexão do host; `transaction` reconstrói os mesmos sobre a transação. */
export function createDrizzleCouponPersistence(db: CouponDatabase): CouponPersistence {
  return {
    ...buildStores(db),
    transaction: (work) => db.transaction((transaction) => work(buildStores(transaction as unknown as CouponDatabase))),
  }
}
