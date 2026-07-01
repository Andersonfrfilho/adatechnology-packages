import { assertConfigField } from '../shared/assertConfigField'
import { buildGraphUrl, graphFetch } from '../shared/graphFetch'
import { WhatsAppConnectionError, WhatsAppRejectionError, WhatsAppWindowExpiredError } from '../errors/WhatsAppError'
import type {
  WhatsAppProviderConfig,
  SendMessageResult,
  SendMediaParams,
  SendTemplateParams,
  FetchMediaResult,
  SendInteractiveButtonsParams,
  SendInteractiveListParams,
  SendCatalogMessageParams,
  SendProductMessageParams,
  SendProductListMessageParams,
} from '../types'

const WINDOW_EXPIRED_CODES = new Set(['131047', '131026', '131000'])
const MAX_INTERACTIVE_BUTTONS = 3
const MAX_INTERACTIVE_LIST_ROWS = 10

export class WhatsAppMessageProvider {
  constructor(private readonly config: WhatsAppProviderConfig) {}

  private get phoneNumberId(): string {
    return assertConfigField(this.config.phoneNumberId, 'phoneNumberId')
  }

  private messagesUrl(): string {
    return buildGraphUrl(this.config.apiVersion, `${this.phoneNumberId}/messages`)
  }

  private async postMessage(payload: Record<string, unknown>): Promise<SendMessageResult> {
    const response = await this.sendWithWindowExpiredHandling(payload)
    const data = response as { messages?: Array<{ id: string }> }
    return { waMessageId: data.messages?.[0]?.id ?? null }
  }

  private async sendWithWindowExpiredHandling(payload: Record<string, unknown>): Promise<unknown> {
    try {
      return await graphFetch({
        url: this.messagesUrl(),
        accessToken: this.config.accessToken,
        method: 'POST',
        jsonBody: payload,
      })
    } catch (error) {
      if (error instanceof WhatsAppRejectionError && WINDOW_EXPIRED_CODES.has(error.code)) {
        throw new WhatsAppWindowExpiredError(error.rawResponse)
      }
      throw error
    }
  }

  async sendText(to: string, body: string): Promise<SendMessageResult> {
    return this.postMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body },
    })
  }

  async sendMedia(params: SendMediaParams): Promise<SendMessageResult> {
    const { to, buffer, mimeType, filename, caption } = params
    const mediaId = await this.uploadMedia(buffer, mimeType, filename)

    const type = mimeType.startsWith('image/') ? 'image'
      : mimeType.startsWith('audio/') ? 'audio'
      : mimeType.startsWith('video/') ? 'video'
      : 'document'

    const mediaBody: Record<string, string> = { id: mediaId }
    if (type === 'document') mediaBody['filename'] = filename
    if (caption && (type === 'image' || type === 'video' || type === 'document')) mediaBody['caption'] = caption

    return this.postMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type,
      [type]: mediaBody,
    })
  }

  private async uploadMedia(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename)
    form.append('messaging_product', 'whatsapp')
    form.append('type', mimeType)

    const response = await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, `${this.phoneNumberId}/media`),
      accessToken: this.config.accessToken,
      method: 'POST',
      formBody: form,
      timeoutMs: 30_000,
    })
    return (response as { id: string }).id
  }

  async sendTemplate(params: SendTemplateParams): Promise<SendMessageResult> {
    const { to, templateName, languageCode = 'pt_BR', bodyParameters = [] } = params
    const components = bodyParameters.length > 0
      ? [{ type: 'body', parameters: bodyParameters.map((text) => ({ type: 'text', text })) }]
      : undefined

    return this.postMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components ? { components } : {}),
      },
    })
  }

  async sendInteractiveButtons(params: SendInteractiveButtonsParams): Promise<SendMessageResult> {
    const { to, bodyText, buttons } = params
    if (buttons.length === 0 || buttons.length > MAX_INTERACTIVE_BUTTONS) {
      throw new WhatsAppRejectionError('WHATSAPP_INVALID_INPUT', `interactive buttons must be between 1 and ${MAX_INTERACTIVE_BUTTONS}`, null)
    }

    return this.postMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: { buttons: buttons.map((button) => ({ type: 'reply', reply: { id: button.id, title: button.title } })) },
      },
    })
  }

  async sendInteractiveList(params: SendInteractiveListParams): Promise<SendMessageResult> {
    const { to, bodyText, buttonText, sections } = params
    const totalRows = sections.reduce((sum, section) => sum + section.rows.length, 0)
    if (totalRows === 0 || totalRows > MAX_INTERACTIVE_LIST_ROWS) {
      throw new WhatsAppRejectionError('WHATSAPP_INVALID_INPUT', `interactive list rows must be between 1 and ${MAX_INTERACTIVE_LIST_ROWS}`, null)
    }

    return this.postMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonText,
          sections: sections.map((section) => ({
            title: section.title,
            rows: section.rows.map((row) => ({ id: row.id, title: row.title, description: row.description })),
          })),
        },
      },
    })
  }

  async sendCatalogMessage(params: SendCatalogMessageParams): Promise<SendMessageResult> {
    const { to, bodyText, footerText } = params

    return this.postMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'catalog_message',
        body: { text: bodyText },
        ...(footerText ? { footer: { text: footerText } } : {}),
        action: { name: 'catalog_message' },
      },
    })
  }

  async sendProductMessage(params: SendProductMessageParams): Promise<SendMessageResult> {
    const { to, retailerId, bodyText, footerText } = params
    const catalogId = assertConfigField(params.catalogId ?? this.config.catalogId, 'catalogId')

    return this.postMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'product',
        ...(bodyText ? { body: { text: bodyText } } : {}),
        ...(footerText ? { footer: { text: footerText } } : {}),
        action: { catalog_id: catalogId, product_retailer_id: retailerId },
      },
    })
  }

  async sendProductListMessage(params: SendProductListMessageParams): Promise<SendMessageResult> {
    const { to, headerText, bodyText, footerText, sections } = params
    const catalogId = assertConfigField(params.catalogId ?? this.config.catalogId, 'catalogId')

    return this.postMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'product_list',
        header: { type: 'text', text: headerText },
        body: { text: bodyText },
        ...(footerText ? { footer: { text: footerText } } : {}),
        action: {
          catalog_id: catalogId,
          sections: sections.map((section) => ({
            title: section.title,
            product_items: section.retailerIds.map((retailerId) => ({ product_retailer_id: retailerId })),
          })),
        },
      },
    })
  }

  async fetchMediaAsBase64(mediaId: string): Promise<FetchMediaResult> {
    const urlData = await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, mediaId),
      accessToken: this.config.accessToken,
    }) as { url: string; mime_type: string }

    let dataResponse: Response
    try {
      dataResponse = await fetch(urlData.url, {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      throw new WhatsAppConnectionError(error instanceof Error ? error.message : 'unknown error')
    }
    if (!dataResponse.ok) {
      throw new WhatsAppRejectionError(String(dataResponse.status), 'failed to download media', null)
    }

    const arrayBuffer = await dataResponse.arrayBuffer()
    return { data: Buffer.from(arrayBuffer).toString('base64'), mimeType: urlData.mime_type }
  }
}
