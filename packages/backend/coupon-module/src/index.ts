/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { createCouponModule } from './CouponModule'
export type { CouponModule, CouponModuleProviders, CreateCouponModuleParams } from './CouponModule'

export { createCouponRoutes } from './http/routes'
export type { CreateCouponRoutesParams, PublicCompanyResolverPort } from './http/routes'

export { runCouponMigrations, couponMigrationsFolder, COUPON_MIGRATIONS_TABLE } from './runMigrations'
export type { RunCouponMigrationsParams } from './runMigrations'
export type { CouponDatabase, DrizzleMigrateFunction } from './database.types'

export { couponsSchema, campaigns, coupons, leads, redemptions } from './schema/schema'
export type {
  CampaignRow,
  NewCampaignRow,
  CouponRow,
  NewCouponRow,
  LeadRow,
  NewLeadRow,
  RedemptionRow,
  NewRedemptionRow,
} from './schema/schema'

export { createDrizzleCouponPersistence } from './repositories/createDrizzleCouponPersistence'
export { CampaignRepository } from './repositories/CampaignRepository'
export { CouponCodeRepository } from './repositories/CouponCodeRepository'
export { LeadRepository } from './repositories/LeadRepository'
export { RedemptionRepository } from './repositories/RedemptionRepository'
export type {
  CampaignStorePort,
  CouponCodeStorePort,
  LeadStorePort,
  RedemptionStorePort,
  RedemptionTotals,
  CouponStores,
  CouponPersistence,
  CouponDependencies,
  Page,
} from './use-cases/couponModule.types'

export {
  CreateCampaignUseCase,
  UpdateCampaignUseCase,
  GetCampaignUseCase,
  ListCampaignsUseCase,
  RemoveCampaignUseCase,
  GetCampaignReportUseCase,
} from './use-cases/Campaign.use-cases'
export type { CampaignReference } from './use-cases/Campaign.use-cases'
export { GenerateCodesUseCase, ListCouponsUseCase, SetCouponStatusUseCase } from './use-cases/Code.use-cases'
export type { GenerateCodesResult } from './use-cases/Code.use-cases'
export {
  ValidateCouponUseCase,
  FindAutomaticUseCase,
  ListPublicCampaignsUseCase,
  GetPublicCampaignUseCase,
} from './use-cases/Validation.use-cases'
export type { ValidateCouponParams, AutomaticDiscount } from './use-cases/Validation.use-cases'
export { RedeemCouponUseCase, ReleaseRedemptionUseCase, ListRedemptionsUseCase } from './use-cases/Redemption.use-cases'
export type { RedeemCouponParams, RedeemCouponResult } from './use-cases/Redemption.use-cases'
export { CaptureLeadUseCase, ListLeadsUseCase } from './use-cases/Lead.use-cases'
export type { CaptureLeadParams } from './use-cases/Lead.use-cases'
export { ExportCampaignDataUseCase, EXPORT_HEADERS } from './use-cases/Export.use-cases'
export type { ExportParams, ExportResult, ExportFilters } from './use-cases/Export.use-cases'

export { createInMemoryCouponPersistence } from './testing/inMemoryPersistence'
export type { InMemoryState } from './testing/inMemoryPersistence'
