import type {
  FlowActionHandler,
  ObjectStorageInterface,
  SessionState,
  ConversationSession,
  FlowNodeData,
} from '@adatechnology/meta-whatsapp-contracts'
import type { LogMessageParams } from '../use-cases/LogMessage.use-case'

export const STICKER_MIME_TYPE = 'image/webp'

/** O que o host entrega para uma figurinha sair: o WebP já pronto (a Meta pede estático, 512x512, até 100 KB). */
export type StickerSource = {
  readonly buffer: Buffer
  /** Identifica o conteúdo: mesma chave, mesmo arquivo guardado — figurinha nova só quando a chave muda. */
  readonly key: string
}

export type CreateSendStickerActionParams = {
  /**
   * Devolve a figurinha para esta conversa, ou `undefined` para não enviar nada.
   *
   * Porta, e não arquivo na biblioteca: a figurinha de uma empresa costuma ser derivada de outro dado
   * (a marca, por exemplo) e regenerada quando ele muda — o módulo não sabe de onde ela vem, e o host
   * decide também quando NÃO enviar (desligada, cliente antigo).
   */
  resolveSticker: (params: {
    node: FlowNodeData
    session: ConversationSession
    context: Record<string, unknown>
  }) => Promise<StickerSource | undefined>
  logMessage: { execute(params: LogMessageParams): Promise<unknown> }
  /**
   * Guarda os bytes para o painel mostrar a figurinha enviada. Sem storage, o envio acontece e o
   * transcript registra só o tipo — o painel mostra um quadro vazio no lugar.
   */
  objectStorage?: Pick<ObjectStorageInterface, 'upload'>
  startState: SessionState
  // Falha ao mandar a figurinha não pode travar a conversa num nó automático: ela é enfeite.
  onError?: (error: unknown, details: { flowKey: string | null; nodeId: string }) => void
}

function storageKeyOf(params: { companyId: string; stickerKey: string }): string {
  return `meta-whatsapp/${params.companyId}/stickers/${params.stickerKey}.webp`
}

/**
 * Action `send_sticker`: ao passar pelo nó, envia uma figurinha à conversa.
 *
 * Uma por nó, e não uma lista como em `send_media`: figurinha é um gesto (boas-vindas, despedida), não
 * material. A mensagem sai como `type: 'sticker'` — enviada como imagem a Meta a mostra como foto, com
 * moldura e fundo, e a transparência se perde.
 */
export function createSendStickerAction(params: CreateSendStickerActionParams): FlowActionHandler {
  return async ({ node, session, channel, context }) => {
    try {
      const sticker = await params.resolveSticker({ node, session, context })
      if (!sticker) return

      const { externalMessageId } = await channel.sendMedia({
        to: session.whatsappNumber,
        mimeType: STICKER_MIME_TYPE,
        filename: 'sticker.webp',
        buffer: sticker.buffer,
        asSticker: true,
      })

      const uploaded = params.objectStorage
        ? await params.objectStorage.upload({
            buffer: sticker.buffer,
            mimeType: STICKER_MIME_TYPE,
            key: storageKeyOf({ companyId: session.companyId, stickerKey: sticker.key }),
          })
        : undefined

      await params.logMessage.execute({
        companyId: session.companyId,
        whatsappNumber: session.whatsappNumber,
        direction: 'outbound',
        sender: 'bot',
        agentUserId: null,
        type: 'sticker',
        content: '',
        payload: {
          mimeType: STICKER_MIME_TYPE,
          filename: 'sticker.webp',
          ...(uploaded ? { uploadId: uploaded.uploadId } : {}),
        },
        waMessageId: externalMessageId,
        status: 'sent',
        startState: params.startState,
      })
    } catch (error) {
      params.onError?.(error, { flowKey: session.flowKey ?? null, nodeId: node.id })
    }
  }
}
