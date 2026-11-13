import { WhatsAppMessageProvider } from './WhatsAppMessageProvider'
import { WhatsAppTemplateProvider } from './WhatsAppTemplateProvider'
import type { WhatsAppProviderConfig } from './types'

// Agrupa os providers que compartilham a mesma credencial, para o host instanciar uma vez só.
// Diferente da versão anterior (@adatechnology/whatsapp-provider), NÃO expõe `catalog`: catálogo
// é Meta Commerce, não WhatsApp, e vive em @adatechnology/meta-catalog-provider — quem precisa
// dos dois compõe no próprio host, sem arrastar catálogo para quem só manda mensagem.
export type WhatsAppProvider = {
  readonly messages: WhatsAppMessageProvider
  readonly templates: WhatsAppTemplateProvider
}

export function createWhatsAppProvider(config: WhatsAppProviderConfig): WhatsAppProvider {
  return {
    messages: new WhatsAppMessageProvider(config),
    templates: new WhatsAppTemplateProvider(config),
  }
}
