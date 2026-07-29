import type { FlowActionHandler, ObjectStorageInterface, SessionState } from '@adatechnology/meta-whatsapp-contracts'
import type { FlowMediaRepository } from '../repositories/FlowMediaRepository'
import type { LogMessageUseCase } from '../use-cases/LogMessage.use-case'

export type CreateSendMediaActionParams = {
  flowMediaRepository: FlowMediaRepository
  // Precisa de `getObject` — sem ele não há como reenviar o arquivo, e o módulo nem registra
  // esta action (ver createMetaWhatsAppModule).
  objectStorage: ObjectStorageInterface & { getObject: NonNullable<ObjectStorageInterface['getObject']> }
  logMessage: LogMessageUseCase
  startState: SessionState
  // Falha de envio de UM arquivo não deve derrubar a conversa — o cliente ficaria travado num nó
  // automático por causa de um PDF. O host recebe o erro por aqui para alertar/observar.
  onError?: (error: unknown, details: { flowKey: string; nodeId: string; uploadId: string }) => void
}

function mediaTypeFor(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  return 'document'
}

/**
 * Action `send_media`: ao passar pelo nó, envia os arquivos que a biblioteca tem anexados a ele.
 *
 * É a única action built-in que o módulo implementa de ponta a ponta — as outras
 * (`handoff`, `send_product_list`) dependem de regra de negócio do produto. Esta não: "mandar
 * estes arquivos ao chegar aqui" é comportamento de canal, e replicá-la em cada host seria
 * copiar o mesmo código com os mesmos bugs.
 *
 * O nó não guarda os arquivos em `actionParams` de propósito. Se guardasse, trocar o material
 * exigiria editar e republicar o grafo — e o ponto todo é o contrário: quem cuida do conteúdo
 * troca o arquivo na biblioteca e o fluxo continua igual.
 */
export function createSendMediaAction(params: CreateSendMediaActionParams): FlowActionHandler {
  return async ({ node, session, channel }) => {
    // `flowKey` nulo significa conversa fora de fluxo — não há de onde ler a biblioteca.
    if (!session.flowKey) return

    const location = { companyId: session.companyId, flowKey: session.flowKey, nodeId: node.id }
    const attachments = await params.flowMediaRepository.listActive(location)

    // Sequencial, e não Promise.all: o cliente vê as mensagens na ordem em que chegam, e disparar
    // em paralelo entregaria o folder antes da tabela de preços conforme a latência de cada upload.
    for (const attachment of attachments) {
      try {
        const buffer = await params.objectStorage.getObject(attachment.uploadId)

        const { externalMessageId } = await channel.sendMedia({
          to: session.whatsappNumber,
          buffer,
          mimeType: attachment.mimeType,
          filename: attachment.filename,
          caption: attachment.caption ?? undefined,
        })

        /**
         * Registra no transcript, mas NÃO liga em `documents`: aquela tabela tem índice único em
         * (companyId, uploadId), então o mesmo arquivo da biblioteca — que por definição vai para
         * todo cliente que passar pelo nó — falharia já no segundo envio. O `uploadId` fica no
         * payload, que é o que o painel precisa para renderizar e baixar.
         */
        await params.logMessage.execute({
          companyId: session.companyId,
          whatsappNumber: session.whatsappNumber,
          direction: 'outbound',
          sender: 'bot',
          agentUserId: null,
          type: mediaTypeFor(attachment.mimeType),
          content: attachment.caption ?? attachment.filename,
          payload: {
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            uploadId: attachment.uploadId,
            flowMediaId: attachment.id,
          },
          waMessageId: externalMessageId,
          status: 'sent',
          startState: params.startState,
        })
      } catch (error) {
        params.onError?.(error, { flowKey: location.flowKey, nodeId: node.id, uploadId: attachment.uploadId })
      }
    }
  }
}
