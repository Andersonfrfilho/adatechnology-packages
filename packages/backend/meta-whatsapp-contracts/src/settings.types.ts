// Extraído de financiamento-imobiliario-bot/apps/web/src/pages/MessagesPage.tsx (consumo) e do
// endpoint /settings/whatsapp — chaves que pertencem ao módulo (meta_whatsapp.settings, T5.5),
// nunca ao app_config genérico do host.
export interface WhatsAppSettings {
  templateName: string
  templateLanguage: string
  templateVariables: string[]
  welcomeMessage: string
  farewellMessage: string
}

export interface TemplateVariablesMap {
  [index: number]: string
}

export interface TemplateConfig {
  name: string
  category: 'UTILITY' | 'MARKETING'
  language: string
  headerType: 'NONE' | 'TEXT'
  headerText?: string
  bodyText: string
  footerText?: string
}

export interface WhatsAppTemplateSummary {
  id: string
  name: string
  shortId: string
  displayName: string
  status: string
  category: string
  language: string
  bodyText: string | null
  variableCount: number
}

export interface CreateTemplateResult {
  ok: boolean
  message: string
  status?: string
}
