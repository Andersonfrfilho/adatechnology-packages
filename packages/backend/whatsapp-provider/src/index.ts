export type {
  WhatsAppProviderConfig,
  SendMessageResult,
  SendMediaParams,
  SendTemplateParams,
  FetchMediaResult,
  InteractiveButton,
  SendInteractiveButtonsParams,
  InteractiveListRow,
  InteractiveListSection,
  SendInteractiveListParams,
  SendCatalogMessageParams,
  SendProductMessageParams,
  ProductListSection,
  SendProductListMessageParams,
  CreateTemplateParams,
  CreateTemplateResult,
  WhatsAppTemplateSummary,
  TemplateComponent,
  WhatsAppTemplateDetail,
  DeleteTemplateParams,
  ProductAvailability,
  ProductCondition,
  CatalogProductInput,
  UpdateCatalogProductParams,
  CatalogProductResult,
  CatalogProductDetail,
  CatalogProductSetInput,
  UpdateCatalogProductSetParams,
  CatalogProductSetResult,
} from './types'

export type { WhatsAppProvider } from './WhatsAppProviderFactory'

export { createWhatsAppProvider } from './WhatsAppProviderFactory'

export { WhatsAppMessageProvider } from './providers/WhatsAppMessageProvider'
export { WhatsAppTemplateProvider } from './providers/WhatsAppTemplateProvider'
export { WhatsAppCatalogProvider } from './providers/WhatsAppCatalogProvider'

export {
  WhatsAppError,
  WhatsAppConfigError,
  WhatsAppConnectionError,
  WhatsAppRejectionError,
  WhatsAppTimeoutError,
  WhatsAppWindowExpiredError,
  WhatsAppTemplateDuplicateError,
} from './errors/WhatsAppError'
