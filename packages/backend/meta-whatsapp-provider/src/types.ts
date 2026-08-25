export type WhatsAppProviderConfig = {
  readonly accessToken: string
  readonly apiVersion?: string
  readonly phoneNumberId?: string
  readonly catalogId?: string
  readonly wabaId?: string
  // Sobrescreve https://graph.facebook.com — usado para apontar para um mock local (ex.: WireMock)
  // em dev/teste. Em produção, deixe undefined para usar a Graph API real.
  readonly baseUrl?: string
}

// ---- Messages ----

export type SendMessageResult = {
  readonly waMessageId: string | null
  /**
   * Id do arquivo na Meta usado no envio — o que foi subido agora, ou o que veio reaproveitado.
   *
   * Sai no resultado para quem envia o mesmo arquivo a muitos destinatários poder guardá-lo: a Meta
   * aceita reusar esse id por 30 dias, e sem ele cada envio ressobe o binário inteiro.
   */
  readonly mediaId?: string
}

type SendMediaCommon = {
  readonly to: string
  readonly mimeType: string
  readonly filename: string
  readonly caption?: string
}

/**
 * Ou o binário, ou um `mediaId` já conhecido — nunca nenhum dos dois.
 *
 * União em vez de dois campos opcionais de propósito: com ambos opcionais, "esqueci de passar os
 * dois" compila e só falha na chamada à Meta, em produção. Aqui não se escreve a chamada inválida.
 */
export type SendMediaParams =
  | (SendMediaCommon & { readonly buffer: Buffer; readonly mediaId?: string })
  | (SendMediaCommon & { readonly buffer?: undefined; readonly mediaId: string })

export type SendTemplateParams = {
  readonly to: string
  readonly templateName: string
  readonly languageCode?: string
  readonly bodyParameters?: readonly string[]
}

export type FetchMediaResult = {
  readonly data: string
  readonly mimeType: string
}

export type InteractiveButton = {
  readonly id: string
  readonly title: string
}

export type SendInteractiveButtonsParams = {
  readonly to: string
  readonly bodyText: string
  readonly buttons: readonly InteractiveButton[]
}

export type InteractiveListRow = {
  readonly id: string
  readonly title: string
  readonly description?: string
}

export type InteractiveListSection = {
  readonly title: string
  readonly rows: readonly InteractiveListRow[]
}

export type SendInteractiveListParams = {
  readonly to: string
  readonly bodyText: string
  readonly buttonText: string
  readonly sections: readonly InteractiveListSection[]
}

export type SendCatalogMessageParams = {
  readonly to: string
  readonly bodyText: string
  readonly catalogId?: string
  readonly footerText?: string
}

export type SendProductMessageParams = {
  readonly to: string
  readonly retailerId: string
  readonly catalogId?: string
  readonly bodyText?: string
  readonly footerText?: string
}

export type ProductListSection = {
  readonly title: string
  readonly retailerIds: readonly string[]
}

export type SendProductListMessageParams = {
  readonly to: string
  readonly headerText: string
  readonly bodyText: string
  readonly catalogId?: string
  readonly footerText?: string
  readonly sections: readonly ProductListSection[]
}

// ---- Templates ----

export type CreateTemplateParams = {
  readonly name: string
  readonly category: 'MARKETING' | 'UTILITY'
  readonly language?: string
  readonly headerType?: 'NONE' | 'TEXT'
  readonly headerText?: string
  readonly bodyText: string
  readonly footerText?: string
}

export type CreateTemplateResult = {
  readonly id?: string
  readonly shortId: string
  readonly status: string
}

export type WhatsAppTemplateSummary = {
  readonly id: string
  readonly name: string
  readonly shortId: string
  readonly displayName: string
  readonly status: string
  readonly category: string
  readonly language: string
  readonly bodyText: string | null
  readonly variableCount: number
}

export type TemplateComponent = {
  readonly type: string
  readonly text?: string
  readonly format?: string
}

export type WhatsAppTemplateDetail = WhatsAppTemplateSummary & {
  readonly components: readonly TemplateComponent[]
}

export type DeleteTemplateParams = {
  readonly id: string
  readonly name: string
}
