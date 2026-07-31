// Extraído de financiamento-imobiliario-bot/apps/web/src/pages/MessagesPage.tsx (consumo) e do
// endpoint /settings/whatsapp — chaves que pertencem ao módulo (meta_whatsapp.settings, T5.5),
// nunca ao app_config genérico do host.
/**
 * Quando transcrever nota de voz.
 *
 * Vive no contrato, e não só no módulo, porque atravessa três fronteiras: o painel escolhe, a API
 * transporta e o módulo obedece. Duas definições concorrentes divergiriam no primeiro valor novo.
 */
export type TranscriptionMode = 'auto' | 'onDemand'

export interface WhatsAppSettings {
  templateName: string
  templateLanguage: string
  templateVariables: string[]
  welcomeMessage: string
  farewellMessage: string
  /**
   * Transcrição de áudio ligada para ESTA empresa.
   *
   * Tri-state de propósito: `null` significa "não decidido pelo painel", e aí vale o padrão que o
   * host injetou (tipicamente ambiente). Se fosse `boolean` com padrão `false`, atualizar o módulo
   * desligaria a transcrição de quem já a tinha ligada por variável de ambiente — regressão
   * silenciosa num recurso que estava funcionando.
   *
   * Ligar aqui não cria capacidade: sem engine e chave injetados no host, não há o que transcrever.
   * Ambiente decide se É POSSÍVEL; isto decide se é para FAZER.
   */
  transcriptionEnabled: boolean | null
  /** `null` = herda o modo injetado pelo host. */
  transcriptionMode: TranscriptionMode | null
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
