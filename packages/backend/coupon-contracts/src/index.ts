/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export {
  DISCOUNT_KIND,
  DISCOUNT_KINDS,
  CODE_MODE,
  CODE_MODES,
  SCOPE_KIND,
  SCOPE_KINDS,
  FIELD_REQUIREMENT,
  FIELD_REQUIREMENTS,
  COUPON_STATUS,
  COUPON_STATUSES,
  REDEMPTION_STATUS,
  REDEMPTION_STATUSES,
  COUPON_REJECTION,
  CAPTURE_OUTCOME,
} from './coupon.types'
export type {
  DiscountKind,
  CodeMode,
  ScopeKind,
  FieldRequirement,
  CouponStatus,
  RedemptionStatus,
  CouponRejection,
  CampaignDiscount,
  CampaignScope,
  LeadCaptureFields,
  LeadCaptureSettings,
  Campaign,
  CampaignStats,
  CampaignListItem,
  PublicCampaign,
  Coupon,
  Lead,
  OrderRef,
  Redemption,
  CartItem,
  CouponValidation,
  CampaignReport,
  Pagination,
  Paginated,
  CaptureLeadResult,
  CaptureOutcome,
  CouponQuote,
} from './coupon.types'

export {
  CouponError,
  COUPON_ERROR_CODES,
  CampaignNotFoundError,
  CampaignInUseError,
  DuplicateCouponCodeError,
  InvalidCouponCodeError,
  CouponCodeNotFoundError,
  WrongCodeModeError,
  CodesExhaustedError,
  CouponNotApplicableError,
  OrderAlreadyRedeemedError,
  CampaignUnavailableError,
  InvalidLeadError,
  ConsentRequiredError,
  RateLimitedError,
  CouponConfigMissingError,
  InvalidCampaignError,
  LeadNotFoundError,
} from './errors'
export type { CouponErrorCode, LeadFieldIssue, FieldIssue } from './errors'

export {
  COUPON_LIMITS,
  CAMPAIGN_SORT_FIELDS,
  CAMPAIGN_STATE,
  CAMPAIGN_STATES,
  EXPORT_FORMAT,
  couponCodeSchema,
  codePrefixSchema,
  discountSchema,
  scopeSchema,
  leadCaptureSchema,
  checkCampaignRules,
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsQuerySchema,
  generateCodesSchema,
  cartItemSchema,
  orderRefSchema,
  validateCouponSchema,
  publicValidateCouponSchema,
  findAutomaticSchema,
  quoteCouponSchema,
  redeemCouponSchema,
  releaseRedemptionSchema,
  captureLeadSchema,
  listLeadsQuerySchema,
  listRedemptionsQuerySchema,
  listCouponsQuerySchema,
  exportFormatSchema,
} from './schemas'
export type {
  CampaignSortField,
  CampaignState,
  ExportFormat,
  CampaignRuleIssue,
  CreateCampaignInput,
  CreateCampaignData,
  UpdateCampaignInput,
  UpdateCampaignData,
  ListCampaignsQuery,
  GenerateCodesInput,
  ValidateCouponInput,
  PublicValidateCouponInput,
  FindAutomaticInput,
  QuoteCouponInput,
  RedeemCouponInput,
  ReleaseRedemptionInput,
  CaptureLeadInput,
  ListLeadsQuery,
  ListRedemptionsQuery,
  ListCouponsQuery,
} from './schemas'

export {
  RATE_LIMIT_ACTION,
  COUPON_EVENT,
  EXPORT_KIND,
  DEFAULT_ADMIN_SCOPES,
  DEFAULT_SERVICE_SCOPES,
  DEFAULT_PUBLIC_CACHE_CONTROL,
} from './providers'
export type {
  ClockPort,
  LoggerPort,
  LogMeta,
  LeadContact,
  LeadNotifierPort,
  CustomerIdentityPort,
  RateLimitAction,
  RateLimiterPort,
  CouponEventType,
  CouponHooks,
  ExportedEvent,
  ExportKind,
  CouponModuleConfig,
} from './providers'

export {
  COUPON_CODE_PATTERN,
  COUPON_CODE_MAX_LENGTH,
  CODE_PREFIX_PATTERN,
  GENERATED_CODE_LENGTH,
  GENERATED_CODE_ALPHABET,
  normalizeCouponCode,
  isValidCouponCode,
  normalizeCodePrefix,
  generateCouponCode,
  cryptoRandomInt,
} from './code'
export type { RandomIntSource } from './code'
export { canonicalPhone, canonicalEmail, maskPhone, DEFAULT_PHONE_COUNTRY_CODE } from './contact'

export {
  evaluateCampaign,
  computeDiscountCents,
  isItemInScope,
  isCampaignOpen,
  windowRejection,
  lineTotalCents,
} from './evaluate'
export type { CampaignRules, UsageSnapshot, EvaluateCampaignParams, CampaignEvaluation } from './evaluate'

export { campaignState } from './campaignState'

export { buildCsv, buildCsvLine, neutralizeFormula, CSV_BOM, CSV_CONTENT_TYPE } from './spreadsheet/csv'
export { buildXlsx, columnName, XLSX_CONTENT_TYPE } from './spreadsheet/xlsx'
export { buildZip, crc32 } from './spreadsheet/zip'
export type { ZipEntry } from './spreadsheet/zip'
export type { SpreadsheetCell, SpreadsheetTable } from './spreadsheet/spreadsheet.types'
