import type {
  ChannelAdapterInterface,
  ChannelInteractiveButtonsParams,
  ChannelInteractiveListParams,
  SendChannelMediaParams,
  SendTextOptions,
} from '@adatechnology/meta-whatsapp-contracts'

export type RecordedChannelSend =
  | {
      readonly kind: 'text'
      readonly to: string
      readonly body: string
      readonly options?: SendTextOptions | undefined
    }
  | { readonly kind: 'media'; readonly params: SendChannelMediaParams }
  | {
      readonly kind: 'template'
      readonly params: { to: string; templateName: string; languageCode: string; bodyParameters?: string[] }
    }
  | { readonly kind: 'interactive-list'; readonly params: ChannelInteractiveListParams }
  | { readonly kind: 'interactive-buttons'; readonly params: ChannelInteractiveButtonsParams }
  | {
      readonly kind: 'product-list'
      readonly params: {
        to: string
        headerText: string
        body: string
        footerText?: string
        sections: { title: string; retailerIds: string[] }[]
      }
    }

export type RecordingChannelAdapterOptions = {
  /**
   * Chamado a cada envio, depois de registrado — o simulador usa para empurrar a resposta do bot à
   * tela (SSE, WebSocket). Erro lançado aqui sobe para quem enviou.
   */
  readonly onSend?: (send: RecordedChannelSend & { readonly externalMessageId: string }) => Promise<void> | void
  /** Mídia devolvida por `fetchMediaAsBase64`. Ausente, a busca falha — não há Meta para consultar. */
  readonly fetchMedia?: (mediaId: string) => Promise<{ data: string; mimeType: string }>
}

/**
 * Canal que não chama a Meta: registra cada envio e devolve um `externalMessageId` sintético
 * (`sandbox.<n>`). Para sandbox, simulador de conversa e teste — injete em
 * `createMetaWhatsAppModule({ providers: { channel } })`. Implementa todos os métodos opcionais da
 * porta, então botões e vitrine saem como sairiam pela Graph API.
 */
export class RecordingChannelAdapter implements ChannelAdapterInterface {
  readonly sent: (RecordedChannelSend & { readonly externalMessageId: string })[] = []
  private sequence = 0

  constructor(private readonly options: RecordingChannelAdapterOptions = {}) {}

  private async record(send: RecordedChannelSend): Promise<{ externalMessageId: string }> {
    this.sequence += 1
    const recorded = { ...send, externalMessageId: `sandbox.${this.sequence}` }
    this.sent.push(recorded)
    await this.options.onSend?.(recorded)
    return { externalMessageId: recorded.externalMessageId }
  }

  sendText(to: string, body: string, options?: SendTextOptions): Promise<{ externalMessageId: string }> {
    return this.record({ kind: 'text', to, body, options })
  }

  async sendMedia(params: SendChannelMediaParams): Promise<{ externalMessageId: string; mediaId: string }> {
    const { externalMessageId } = await this.record({ kind: 'media', params })
    return { externalMessageId, mediaId: params.mediaId ?? `sandbox-media.${this.sequence}` }
  }

  sendTemplate(params: {
    to: string
    templateName: string
    languageCode: string
    bodyParameters?: string[]
  }): Promise<{ externalMessageId: string }> {
    return this.record({ kind: 'template', params })
  }

  sendInteractiveList(params: ChannelInteractiveListParams): Promise<{ externalMessageId: string }> {
    return this.record({ kind: 'interactive-list', params })
  }

  sendInteractiveButtons(params: ChannelInteractiveButtonsParams): Promise<{ externalMessageId: string }> {
    return this.record({ kind: 'interactive-buttons', params })
  }

  sendProductList(params: {
    to: string
    headerText: string
    body: string
    footerText?: string
    sections: { title: string; retailerIds: string[] }[]
  }): Promise<{ externalMessageId: string }> {
    return this.record({ kind: 'product-list', params })
  }

  fetchMediaAsBase64(mediaId: string): Promise<{ data: string; mimeType: string }> {
    if (!this.options.fetchMedia) {
      return Promise.reject(new Error(`RecordingChannelAdapter has no fetchMedia for ${mediaId}`))
    }
    return this.options.fetchMedia(mediaId)
  }
}
