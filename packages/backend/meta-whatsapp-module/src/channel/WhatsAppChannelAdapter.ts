import { WhatsAppWindowExpiredError as ProviderWindowExpiredError } from '@adatechnology/meta-graph-core'
import type { WhatsAppMessageProvider } from '@adatechnology/meta-whatsapp-provider'
import {
  WindowExpiredError,
  isPreviewContact,
  type ChannelAdapterInterface,
  type ChannelInteractiveButtonsParams,
  type ChannelInteractiveListParams,
  type ObjectStorageInterface,
  type SendChannelMediaParams,
} from '@adatechnology/meta-whatsapp-contracts'
import { resolvePreviewUploadId } from './previewMedia'

/**
 * Leitura de mídia do simulador de conversa.
 *
 * **Atrás de flag de propósito, e não ligado por omissão.** Aceitar id que não veio da Meta é
 * exatamente o que um webhook forjado exploraria: bastaria mandar `preview-upload:<chave>` para
 * fazer o servidor ler um objeto arbitrário do storage e devolvê-lo. Num ambiente de simulação isso
 * é o recurso; em produção é leitura arbitrária. Quem liga assume, e a decisão fica visível no
 * lugar onde o módulo é montado.
 */
export type PreviewMediaSupport = {
  readonly isEnabled: boolean
  readonly objectStorage: ObjectStorageInterface & {
    getObject: NonNullable<ObjectStorageInterface['getObject']>
  }
  /** Mime a devolver, já que o storage guarda bytes e não o tipo. Padrão `audio/ogg`. */
  readonly defaultMimeType?: string
}

/**
 * Respostas a contatos do simulador (`isPreviewContact`). Ligado, todo envio para um número que
 * começa com `0` volta `preview.<uuid>` sem chamar a Meta — janela, transcript, SSE e status seguem
 * iguais, então o simulador vê exatamente o que o cliente veria. Nenhum `wa_id` real começa com `0`.
 */
export type PreviewContactsSupport = {
  readonly isEnabled: boolean
  readonly generateId?: () => string
}

// T5.2 — implementa a porta ChannelAdapterInterface sobre o meta-whatsapp-provider. A camada de
// conversa fala só com esta porta e nunca com a Graph API, o que é o que permite trocar o canal
// (ou usar um dublê em teste) sem tocar no motor de fluxo.
//
// Também traduz os erros do provider (que são da família MetaGraphError) para os erros de
// domínio do módulo — o host trata WindowExpiredError sem precisar conhecer meta-graph-core.
export class WhatsAppChannelAdapter implements ChannelAdapterInterface {
  constructor(
    private readonly messages: WhatsAppMessageProvider,
    /**
     * Ausente, o adaptador se comporta como sempre: todo id vai para a Graph API. É o que garante
     * que atualizar o pacote não abre nada em quem não pediu.
     */
    private readonly previewMedia?: PreviewMediaSupport,
    private readonly previewContacts?: PreviewContactsSupport,
  ) {}

  /** `preview.<uuid>` quando o destino é contato do simulador e o recurso está ligado. */
  private previewMessageId(to: string): string | undefined {
    if (!this.previewContacts?.isEnabled || !isPreviewContact(to)) return undefined
    return `preview.${this.previewContacts.generateId?.() ?? globalThis.crypto.randomUUID()}`
  }

  private async translateErrors<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof ProviderWindowExpiredError) throw new WindowExpiredError()
      throw error
    }
  }

  async sendText(to: string, body: string): Promise<{ externalMessageId: string | null }> {
    const previewId = this.previewMessageId(to)
    if (previewId) return { externalMessageId: previewId }
    const result = await this.translateErrors(() => this.messages.sendText(to, body))
    return { externalMessageId: result.waMessageId }
  }

  async sendMedia(params: SendChannelMediaParams): Promise<{
    externalMessageId: string | null
    mediaId?: string | undefined
  }> {
    const previewId = this.previewMessageId(params.to)
    if (previewId) return { externalMessageId: previewId }
    const result = await this.translateErrors(() => this.messages.sendMedia(params))
    return { externalMessageId: result.waMessageId, mediaId: result.mediaId }
  }

  async sendTemplate(params: {
    to: string
    templateName: string
    languageCode: string
    bodyParameters?: string[]
  }): Promise<{ externalMessageId: string | null }> {
    const previewId = this.previewMessageId(params.to)
    if (previewId) return { externalMessageId: previewId }
    const result = await this.translateErrors(() => this.messages.sendTemplate(params))
    return { externalMessageId: result.waMessageId }
  }

  async sendInteractiveList(params: ChannelInteractiveListParams): Promise<{ externalMessageId: string | null }> {
    const previewId = this.previewMessageId(params.to)
    if (previewId) return { externalMessageId: previewId }
    // Seção sem título herda o rótulo do botão — é o que a forma `rows` sempre fez, e a Meta só
    // exige título próprio quando há mais de uma seção.
    const sections = (params.sections ?? [{ rows: params.rows ?? [] }]).map((section) => ({
      title: section.title ?? params.buttonLabel,
      rows: section.rows.map((row) => ({
        id: row.id,
        title: row.title,
        ...(row.description ? { description: row.description } : {}),
      })),
    }))
    const result = await this.translateErrors(() =>
      this.messages.sendInteractiveList({
        to: params.to,
        bodyText: params.body,
        buttonText: params.buttonLabel,
        sections,
      }),
    )
    return { externalMessageId: result.waMessageId }
  }

  async sendInteractiveButtons(params: ChannelInteractiveButtonsParams): Promise<{ externalMessageId: string | null }> {
    const previewId = this.previewMessageId(params.to)
    if (previewId) return { externalMessageId: previewId }
    const result = await this.translateErrors(() =>
      this.messages.sendInteractiveButtons({
        to: params.to,
        bodyText: params.body,
        buttons: params.buttons,
      }),
    )
    return { externalMessageId: result.waMessageId }
  }

  async sendProductList(params: {
    to: string
    headerText: string
    body: string
    footerText?: string
    sections: { title: string; retailerIds: string[] }[]
  }): Promise<{ externalMessageId: string | null }> {
    const previewId = this.previewMessageId(params.to)
    if (previewId) return { externalMessageId: previewId }
    const result = await this.translateErrors(() =>
      this.messages.sendProductListMessage({
        to: params.to,
        headerText: params.headerText,
        bodyText: params.body,
        ...(params.footerText ? { footerText: params.footerText } : {}),
        sections: params.sections,
      }),
    )
    return { externalMessageId: result.waMessageId }
  }

  /**
   * Busca o binário da mídia — da Meta, ou do storage quando o id é do simulador.
   *
   * O desvio acontece ANTES de qualquer chamada de rede: id do simulador não existe na Meta, e
   * tentar buscá-lo lá renderia um 404 confuso em vez do áudio que o operador acabou de gravar.
   */
  async fetchMediaAsBase64(mediaId: string): Promise<{ data: string; mimeType: string }> {
    const uploadId = this.previewMedia?.isEnabled ? resolvePreviewUploadId(mediaId) : undefined

    if (uploadId) {
      const buffer = await this.previewMedia!.objectStorage.getObject(uploadId)
      return {
        data: buffer.toString('base64'),
        mimeType: this.previewMedia!.defaultMimeType ?? 'audio/ogg',
      }
    }

    return this.translateErrors(() => this.messages.fetchMediaAsBase64(mediaId))
  }
}
