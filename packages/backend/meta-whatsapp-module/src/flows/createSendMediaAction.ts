import type {
  ChannelAdapterInterface,
  FlowActionHandler,
  ObjectStorageInterface,
  SessionState,
} from '@adatechnology/meta-whatsapp-contracts'
import type { FlowMediaRepository } from '../repositories/FlowMediaRepository'
import type { LogMessageParams } from '../use-cases/LogMessage.use-case'

/**
 * Porta de escrita no transcript, e não a classe `LogMessageUseCase`.
 *
 * Exigir a classe amarraria a action a quem já guarda as mensagens nas tabelas do módulo — um host
 * em migração, com o transcript ainda no schema dele, não conseguiria usar a única action built-in
 * sem gravar o envio numa tabela que o painel dele não lê. O que a action precisa é só de um lugar
 * para registrar o que saiu.
 */
/**
 * Onde guardar o `mediaId` que a Meta devolveu para cada arquivo da biblioteca.
 *
 * Porta, e não tabela: o módulo não sabe se o host guarda isso numa coluna, no Redis ou em memória.
 * O que ele precisa é reaproveitar o id em vez de ressubir o mesmo binário para cada cliente que
 * passa pelo nó — a Meta aceita reusar por 30 dias.
 */
export type FlowMediaIdStore = {
  get(params: { flowMediaId: string; senderKey: string }): Promise<string | undefined>
  set(params: { flowMediaId: string; senderKey: string; mediaId: string }): Promise<void>
  clear(params: { flowMediaId: string; senderKey: string }): Promise<void>
}

/**
 * O `senderKey` vem junto do store, e não solto, para não existir a forma inválida.
 *
 * O `mediaId` é escopado ao número remetente (`phone_number_id`) na Meta: cachear sem separar por
 * número faz o id de um número ser mandado pelo outro, e o envio falha. Exigi-lo dentro do mesmo
 * objeto torna "liguei o cache e esqueci o número" impossível de escrever.
 */
export type FlowMediaIdCache = {
  readonly store: FlowMediaIdStore
  readonly senderKey: string
}

export type FlowMediaTranscriptLogger = {
  execute(params: LogMessageParams): Promise<unknown>
}

export type CreateSendMediaActionParams = {
  flowMediaRepository: FlowMediaRepository
  // Precisa de `getObject` — sem ele não há como reenviar o arquivo, e o módulo nem registra
  // esta action (ver createMetaWhatsAppModule).
  objectStorage: ObjectStorageInterface & { getObject: NonNullable<ObjectStorageInterface['getObject']> }
  logMessage: FlowMediaTranscriptLogger
  /**
   * Reaproveitamento do arquivo já subido. Capacidade por ausência: sem o cache, cada envio ressobe
   * o binário — exatamente o comportamento anterior, sem flag para desligar.
   */
  mediaIdCache?: FlowMediaIdCache
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
/**
 * Envia um anexo, reaproveitando o arquivo já subido quando houver cache.
 *
 * O caminho rápido não faz NENHUMA das duas coisas caras: não baixa o binário do storage e não o
 * sobe para a Meta. Sobra a chamada de envio.
 *
 * O erro no caminho rápido cai no caminho lento em vez de propagar. O motivo é que a única falha
 * esperada ali — id expirado, ou apagado do lado da Meta — é indistinguível de uma falha de rede
 * sem inspecionar código de erro da Graph API, e tratar as duas igual custa uma tentativa a mais no
 * pior caso e acerta nos dois. Sem isso, um id vencido pararia de entregar material silenciosamente
 * até alguém notar.
 */
async function sendAttachment(params: {
  attachment: { id: string; uploadId: string; mimeType: string; filename: string; caption: string | null }
  channel: Pick<ChannelAdapterInterface, 'sendMedia'>
  to: string
  objectStorage: { getObject: (uploadId: string) => Promise<Buffer> }
  cache?: FlowMediaIdCache
}): Promise<{ externalMessageId: string | null }> {
  const { attachment, channel, to, cache } = params
  const common = {
    to,
    mimeType: attachment.mimeType,
    filename: attachment.filename,
    caption: attachment.caption ?? undefined,
  }
  const cacheKey = cache ? { flowMediaId: attachment.id, senderKey: cache.senderKey } : undefined

  if (cache && cacheKey) {
    const knownMediaId = await cache.store.get(cacheKey)
    if (knownMediaId) {
      try {
        return await channel.sendMedia({ ...common, mediaId: knownMediaId })
      } catch {
        await cache.store.clear(cacheKey)
      }
    }
  }

  const buffer = await params.objectStorage.getObject(attachment.uploadId)
  const result = await channel.sendMedia({ ...common, buffer })

  // Grava depois do envio bem-sucedido: id que a Meta ainda não confirmou não vale cachear.
  if (cache && cacheKey && result.mediaId) await cache.store.set({ ...cacheKey, mediaId: result.mediaId })

  return result
}

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
        const { externalMessageId } = await sendAttachment({
          attachment,
          channel,
          to: session.whatsappNumber,
          objectStorage: params.objectStorage,
          ...(params.mediaIdCache ? { cache: params.mediaIdCache } : {}),
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
