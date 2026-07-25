import { WhatsAppMessageProvider } from './providers/WhatsAppMessageProvider'
import { WhatsAppTemplateProvider } from './providers/WhatsAppTemplateProvider'
import { WhatsAppCatalogProvider } from './providers/WhatsAppCatalogProvider'
import type { WhatsAppProviderConfig } from './types'

export type WhatsAppProvider = {
  readonly messages: WhatsAppMessageProvider
  readonly templates: WhatsAppTemplateProvider
  readonly catalog: WhatsAppCatalogProvider
}

export function createWhatsAppProvider(config: WhatsAppProviderConfig): WhatsAppProvider {
  return {
    messages: new WhatsAppMessageProvider(config),
    templates: new WhatsAppTemplateProvider(config),
    catalog: new WhatsAppCatalogProvider(config),
  }
}
