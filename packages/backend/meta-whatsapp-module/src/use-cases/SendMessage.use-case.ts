import {
  WindowExpiredError,
  type ChannelAdapterInterface,
  type ObjectStorageInterface,
  type SessionState,
} from '@adatechnology/meta-whatsapp-contracts'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { DocumentRepository } from '../repositories/DocumentRepository'
import type { LogMessageUseCase } from './LogMessage.use-case'
import type { MessageRow } from '../schema/schema'

const WHATSAPP_WINDOW_HOURS = 24

export type SendTextParams = {
  companyId: string
  whatsappNumber: string
  body: string
  sender: 'bot' | 'agent'
  agentUserId?: string
  startState: SessionState
}

export type SendMediaParams = {
  companyId: string
  whatsappNumber: string
  buffer: Buffer
  mimeType: string
  filename: string
  caption?: string
  sender: 'bot' | 'agent'
  agentUserId?: string
  startState: SessionState
}

export type SendTemplateParams = {
  companyId: string
  whatsappNumber: string
  templateName: string
  languageCode?: string
  bodyParameters?: string[]
  sender: 'bot' | 'agent'
  agentUserId?: string
  startState: SessionState
}

// T5.2 — envio pelo canal + registro no transcript, num único ponto.
//
// A checagem de janela acontece ANTES da chamada à Graph API: a Meta também rejeitaria
// (o adapter traduz o erro dela para WindowExpiredError), mas gastar uma ida à rede para
// descobrir algo que o nosso próprio lastInboundAt já sabe é desperdício — e o erro local
// carrega há quantas horas o cliente sumiu, que a resposta da Meta não informa.
export class SendMessageUseCase {
  constructor(
    private readonly channel: ChannelAdapterInterface,
    private readonly sessionRepository: SessionRepository,
    private readonly logMessage: LogMessageUseCase,
    private readonly objectStorage?: ObjectStorageInterface,
    // Opcional pelo mesmo motivo do IngestInboundMedia: sem ele o envio continua funcionando, só
    // não entra na biblioteca de arquivos da conversa.
    private readonly documentRepository?: DocumentRepository,
  ) {}

  private async assertWithinWindow(companyId: string, whatsappNumber: string): Promise<void> {
    const hours = await this.sessionRepository.hoursSinceLastInbound(companyId, whatsappNumber)
    // Cliente que nunca escreveu: não há janela aberta, só template pode iniciar a conversa.
    if (hours === undefined) throw new WindowExpiredError()
    if (hours >= WHATSAPP_WINDOW_HOURS) throw new WindowExpiredError(hours)
  }

  async sendText(params: SendTextParams): Promise<MessageRow | undefined> {
    await this.assertWithinWindow(params.companyId, params.whatsappNumber)

    const { externalMessageId } = await this.channel.sendText(params.whatsappNumber, params.body)

    return this.logMessage.execute({
      companyId: params.companyId,
      whatsappNumber: params.whatsappNumber,
      direction: 'outbound',
      sender: params.sender,
      agentUserId: params.agentUserId ?? null,
      type: 'text',
      content: params.body,
      waMessageId: externalMessageId,
      status: 'sent',
      startState: params.startState,
    })
  }

  async sendMedia(params: SendMediaParams): Promise<MessageRow | undefined> {
    await this.assertWithinWindow(params.companyId, params.whatsappNumber)

    const { externalMessageId } = await this.channel.sendMedia({
      to: params.whatsappNumber,
      buffer: params.buffer,
      mimeType: params.mimeType,
      filename: params.filename,
      caption: params.caption,
    })

    // T5.4 — o binário vai para o storage do host e o transcript guarda só a referência.
    // Gravar base64 no jsonb (dívida herdada do bot) inchava a tabela de mensagens, tornava
    // qualquer SELECT da conversa caro e duplicava um dado que o storage já tem.
    const uploadId = this.objectStorage
      ? (
          await this.objectStorage.upload({
            buffer: params.buffer,
            mimeType: params.mimeType,
            key: `meta-whatsapp/${params.companyId}/${Date.now()}-${params.filename}`,
          })
        ).uploadId
      : undefined

    const saved = await this.logMessage.execute({
      companyId: params.companyId,
      whatsappNumber: params.whatsappNumber,
      direction: 'outbound',
      sender: params.sender,
      agentUserId: params.agentUserId ?? null,
      type: mediaTypeFor(params.mimeType),
      content: params.caption ?? params.filename,
      payload: { filename: params.filename, mimeType: params.mimeType, ...(uploadId ? { uploadId } : {}) },
      waMessageId: externalMessageId,
      status: 'sent',
      startState: params.startState,
    })

    // Arquivo que o atendente manda ao cliente também é arquivo da conversa: quem atende depois
    // precisa achar o que já foi enviado sem rolar a thread inteira.
    //
    // Só quando `saved` existe — `undefined` significa entrega duplicada, e linkar aí criaria uma
    // segunda linha para a mesma mensagem. E só com `uploadId`: sem storage não há objeto para
    // apontar, e documento sem destino é linha morta no painel.
    if (saved && uploadId) {
      await this.documentRepository?.link({
        companyId: params.companyId,
        sessionId: saved.sessionId,
        messageId: saved.id,
        uploadId,
        filename: params.filename,
        mimeType: params.mimeType,
        sizeBytes: params.buffer.length,
        source: params.sender,
      })
    }

    return saved
  }

  // Template é o único envio que ignora a janela — é justamente o mecanismo que a Meta oferece
  // para reabri-la.
  async sendTemplate(params: SendTemplateParams): Promise<MessageRow | undefined> {
    const { externalMessageId } = await this.channel.sendTemplate({
      to: params.whatsappNumber,
      templateName: params.templateName,
      languageCode: params.languageCode ?? 'pt_BR',
      bodyParameters: params.bodyParameters,
    })

    return this.logMessage.execute({
      companyId: params.companyId,
      whatsappNumber: params.whatsappNumber,
      direction: 'outbound',
      sender: params.sender,
      agentUserId: params.agentUserId ?? null,
      type: 'template',
      content: params.templateName,
      payload: { templateName: params.templateName, bodyParameters: params.bodyParameters ?? [] },
      waMessageId: externalMessageId,
      status: 'sent',
      startState: params.startState,
    })
  }
}

function mediaTypeFor(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  return 'document'
}
