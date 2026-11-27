/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { CouponsProvider, useCouponsAdminApi, useCouponsPublicApi, useCouponsText } from './providers/CouponsProvider'
export type { CouponsProviderProps, CouponsText } from './providers/CouponsProvider'
export type {
  CouponsAdminApi,
  CouponsPublicApi,
  ListCampaignsParams,
  ListRecordsParams,
  ExportRequest,
  GenerateCodesResult,
  SortOrder,
  SelectOption,
  SelectInputProps,
  RenderSelect,
  DateTimeInputProps,
  RenderDateTimeInput,
} from './providers/types'

// Telas compostas (padrão de consumo).
export { CampaignsWorkspace } from './components/CampaignsWorkspace'
export type { CampaignsWorkspaceProps } from './components/CampaignsWorkspace'
export { CouponField } from './components/CouponField'
export type { CouponFieldProps } from './components/CouponField'
export { LeadCaptureDialog } from './components/LeadCaptureDialog'
export type { LeadCaptureDialogProps } from './components/LeadCaptureDialog'
export { CampaignBanner } from './components/CampaignBanner'
export type { CampaignBannerProps } from './components/CampaignBanner'

// Peças, para quem precisa montar diferente (exceção justificada).
export { CampaignList } from './components/CampaignList'
export type { CampaignListProps } from './components/CampaignList'
export { CampaignDetail, CAMPAIGN_TAB } from './components/CampaignDetail'
export type { CampaignDetailProps, CampaignTab } from './components/CampaignDetail'
export { CampaignEditor } from './components/CampaignEditor'
export type { CampaignEditorProps } from './components/CampaignEditor'
export { CampaignTable } from './components/CampaignTable'
export type { CampaignTableProps } from './components/CampaignTable'
export { ReportPanel } from './components/ReportPanel'
export { StateChip } from './components/StateChip'
export { Pagination } from './components/Pagination'
export type { PaginationProps } from './components/Pagination'
export { ListToolbar } from './components/ListToolbar'
export type { ListToolbarProps } from './components/ListToolbar'
export { ExportMenu } from './components/ExportMenu'
export type { ExportMenuProps, ExportScope } from './components/ExportMenu'

// Camada headless.
export { useCampaignList } from './hooks/useCampaignList'
export type { CampaignListController } from './hooks/useCampaignList'
export { useCampaignEditor } from './hooks/useCampaignEditor'
export type { CampaignEditorState } from './hooks/useCampaignEditor'
export { useRecordList } from './hooks/useRecordList'
export type { RecordListController, RecordListState } from './hooks/useRecordList'
export { useCouponPreview } from './hooks/useCouponPreview'
export type { CouponCheck, PreviewCoupon } from './hooks/useCouponPreview'
export { useLeadCapture, validateLeadForm } from './hooks/useLeadCapture'
export type { LeadFormValues } from './hooks/useLeadCapture'
export { useAsyncResource } from './hooks/useAsyncResource'
export type { AsyncResource } from './hooks/useAsyncResource'

export {
  draftFromCampaign,
  draftToInput,
  draftToUpdate,
  validateDraft,
  isDraftDirty,
  EMPTY_CAMPAIGN_DRAFT,
} from './lib/campaignDraft'
export type { CampaignDraft } from './lib/campaignDraft'
export {
  parseCampaignListState,
  serializeCampaignListState,
  DEFAULT_CAMPAIGN_LIST_STATE,
  PAGE_SIZE_OPTIONS,
} from './lib/listUrlState'
export type { CampaignListState, CampaignSortKey } from './lib/listUrlState'
export {
  formatCents,
  formatDiscount,
  parseCentsInput,
  formatCentsInput,
  formatPhone,
  maskPhoneInput,
} from './lib/format'
export { readErrorCode, readFieldIssues, readRejections } from './lib/apiError'
export { rejectionMessage, fieldLabel, STATE_LABEL_KEY } from './lib/labels'
export { buildSpreadsheetBlob, downloadBlob } from './lib/spreadsheetDownload'

export { resolveCouponsMessages, interpolate, DEFAULT_COUPONS_LOCALE } from './locales'
export type { CouponsMessages, CouponsLocale } from './locales'
