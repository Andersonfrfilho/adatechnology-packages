import { WhatsAppWindowExpiredError as ProviderWindowExpiredError } from '@adatechnology/meta-graph-core'
import type { WhatsAppMessageProvider } from '@adatechnology/meta-whatsapp-provider'
import { WindowExpiredError, type ChannelAdapterInterface } from '@adatechnology/meta-whatsapp-contracts'

// T5.2 — implementa a porta ChannelAdapterInterface sobre o meta-whatsapp-provider. A camada de
// conversa fala só com esta porta e nunca com a Graph API, o que é o que permite trocar o canal
// (ou usar um dublê em teste) sem tocar no motor de fluxo.
//
// Também traduz os erros do provider (que são da família MetaGraphError) para os erros de
// domínio do módulo — o host trata WindowExpiredError sem precisar conhecer meta-graph-core.
export class WhatsAppChannelAdapter implements ChannelAdapterInterface {
  constructor(private readonly messages: WhatsAppMessageProvider) {}

  private async translateErrors<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof ProviderWindowExpiredError) throw new WindowExpiredError()
      throw error
    }
  }

  async sendText(to: string, body: string): Promise<{ externalMessageId: string | null }> {
    const result = await this.translateErrors(() => this.messages.sendText(to, body))
    return { externalMessageId: result.waMessageId }
  }

  async sendMedia(params: {
    to: string
    buffer: Buffer
    mimeType: string
    filename: string
    caption?: string
  }): Promise<{ externalMessageId: string | null }> {
    const result = await this.translateErrors(() => this.messages.sendMedia(params))
    return { externalMessageId: result.waMessageId }
  }

  async sendTemplate(params: {
    to: string
    templateName: string
    languageCode: string
    bodyParameters?: string[]
  }): Promise<{ externalMessageId: string | null }> {
    const result = await this.translateErrors(() => this.messages.sendTemplate(params))
    return { externalMessageId: result.waMessageId }
  }

  async sendInteractiveList(params: {
    to: string
    body: string
    buttonLabel: string
    rows: { id: string; title: string }[]
  }): Promise<{ externalMessageId: string | null }> {
    const result = await this.translateErrors(() =>
      this.messages.sendInteractiveList({
        to: params.to,
        bodyText: params.body,
        buttonText: params.buttonLabel,
        sections: [{ title: params.buttonLabel, rows: params.rows }],
      }),
    )
    return { externalMessageId: result.waMessageId }
  }

  async fetchMediaAsBase64(mediaId: string): Promise<{ data: string; mimeType: string }> {
    return this.translateErrors(() => this.messages.fetchMediaAsBase64(mediaId))
  }
}
