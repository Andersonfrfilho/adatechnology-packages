import { eq, and } from 'drizzle-orm'
import type { MetaWhatsAppDatabase } from '../database.types'
import type {
  ChannelAdapterInterface,
  MetaWhatsAppHooks,
  ObjectStorageInterface,
} from '@adatechnology/meta-whatsapp-contracts'
import type { DocumentRepository } from '../repositories/DocumentRepository'
import type { MessageRepository } from '../repositories/MessageRepository'
import { messages, type MessageRow } from '../schema/schema'
import { resolveFailureStatus } from '../use-cases/TranscribeAudio.use-case'
import type { TranscriptionPolicyResolver } from '../use-cases/resolveTranscriptionPolicy'
import {
  TRANSCRIPTION_MODE,
  TRANSCRIPTION_STATUS,
  isAudioMimeType,
  transcriptionRetryAfterSeconds,
  type AudioTranscriber,
  type TranscriptionStatus,
} from '../transcription.types'

export type IngestInboundMediaParams = {
  companyId: string
  messageId: string
  // ID da mídia na Meta — a URL de download expira, então o binário precisa ser copiado para o
  // storage do host antes de sumir.
  sourceMediaId: string
  mimeType: string
  filename?: string
}

export type IngestInboundMediaResult = {
  uploadId: string
  // true quando a mídia já estava no storage e nada foi baixado de novo.
  alreadyIngested: boolean
  /**
   * Só presente quando a transcrição automática rodou nesta execução. Ausente é o normal: mídia que
   * não é áudio, transcrição desligada, modo sob demanda, ou mídia já ingerida antes.
   */
  transcription?: { status: TranscriptionStatus }
}

/**
 * Transcrição durante a ingestão — o modo `auto`.
 *
 * Entra aqui, e não em use-case separado, por um motivo só: neste ponto o buffer do áudio ACABOU de
 * ser baixado e está em memória. Transcrever fora daqui custaria um segundo download do storage por
 * áudio, e o `TranscribeAudioUseCase` existe justamente para esse caso (sob demanda e retomada).
 */
export type IngestTranscriptionOptions = {
  transcriber: AudioTranscriber
  messageRepository: MessageRepository
  /**
   * Política POR EMPRESA, resolvida a cada áudio. Não é um `mode` fixo porque o interruptor mora nas
   * configurações da empresa: um valor capturado na construção do use-case congelaria a escolha até
   * o próximo deploy, e o worker é um processo longo — o operador mexeria no painel e nada mudaria.
   */
  resolvePolicy: TranscriptionPolicyResolver
  languageHint?: string
  hooks?: Pick<MetaWhatsAppHooks, 'onTranscriptionDeferred'>
}

// T5.3 — copia mídia recebida da Meta para o storage do host.
//
// Não reimplementa S3: delega ao ObjectStorageInterface que o host injeta (object-storage-provider
// ou o que ele usar). O módulo só orquestra "baixa da Meta → entrega ao storage → referencia na
// mensagem".
//
// Idempotente por sourceMediaId gravado no payload da mensagem: o job pode ser reentregue (fila
// com retry, webhook reprocessado) e baixar de novo custaria banda e geraria um segundo objeto
// órfão no storage para o mesmo binário.
export class IngestInboundMediaUseCase {
  constructor(
    private readonly db: MetaWhatsAppDatabase,
    private readonly channel: ChannelAdapterInterface,
    private readonly objectStorage: ObjectStorageInterface,
    // Opcional: sem ele a mídia continua sendo copiada e referenciada no payload, só não entra na
    // biblioteca da conversa. Mantém compatível quem já usava o use case antes da tabela existir.
    private readonly documentRepository?: DocumentRepository,
    // Último e opcional para não quebrar quem já constrói este use-case posicionalmente. Ausente,
    // a ingestão se comporta exatamente como antes da transcrição existir.
    private readonly transcription?: IngestTranscriptionOptions,
  ) {}

  async execute(params: IngestInboundMediaParams): Promise<IngestInboundMediaResult> {
    const [message] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.companyId, params.companyId), eq(messages.id, params.messageId)))
      .limit(1)

    if (!message) throw new Error(`Mensagem ${params.messageId} não encontrada para ingestão de mídia`)

    const payload = (message.payload ?? {}) as Record<string, unknown>

    // Já ingerida: devolve o uploadId existente sem tocar na rede.
    //
    // Não tenta transcrever aqui de propósito. Sem o download não há buffer, e reler do storage
    // duplicaria o `TranscribeAudioUseCase`. Retomada de transcrição pendente é trabalho DELE — o
    // `onTranscriptionDeferred` carrega o `uploadId` exatamente para o host enfileirar uma
    // transcrição, não uma segunda ingestão.
    if (payload['uploadId'] && payload['sourceMediaId'] === params.sourceMediaId) {
      return { uploadId: String(payload['uploadId']), alreadyIngested: true }
    }

    const { data, mimeType } = await this.channel.fetchMediaAsBase64(params.sourceMediaId)
    const buffer = Buffer.from(data, 'base64')

    const { uploadId } = await this.objectStorage.upload({
      buffer,
      mimeType: mimeType || params.mimeType,
      key: `meta-whatsapp/${params.companyId}/inbound/${params.sourceMediaId}`,
    })

    // Guarda sourceMediaId junto do uploadId: é o que torna a próxima execução idempotente.
    const updatedPayload: Record<string, unknown> = {
      ...payload,
      uploadId,
      sourceMediaId: params.sourceMediaId,
      mimeType: mimeType || params.mimeType,
      // O tamanho já está na mão (é o buffer que acabou de ser copiado) e a bolha de documento o
      // exibe ao lado do tipo. Sem gravar aqui, a UI mostraria "PDF" sem o "· 180 KB", e buscá-lo
      // depois custaria uma consulta à tabela de documentos por mensagem renderizada.
      sizeBytes: buffer.length,
      ...(params.filename ? { filename: params.filename } : {}),
    }

    await this.db
      .update(messages)
      .set({ payload: updatedPayload })
      .where(and(eq(messages.companyId, params.companyId), eq(messages.id, params.messageId)))

    // Entra na biblioteca da conversa. Idempotente por (companyId, uploadId) no repositório, o que
    // importa aqui: a chave do objeto deriva de sourceMediaId, então a reentrega do job produz o
    // mesmo uploadId e o link não duplica.
    await this.documentRepository?.link({
      companyId: params.companyId,
      sessionId: message.sessionId,
      messageId: message.id,
      uploadId,
      // Áudio e sticker chegam sem nome; sem um rótulo o painel mostraria linha vazia.
      filename: params.filename ?? `${params.sourceMediaId}`,
      mimeType: mimeType || params.mimeType,
      sizeBytes: buffer.length,
      source: message.sender,
    })

    const transcription = await this.transcribeIfAuto({
      companyId: params.companyId,
      message,
      uploadId,
      buffer,
      mimeType: mimeType || params.mimeType,
    })

    return { uploadId, alreadyIngested: false, ...(transcription ? { transcription } : {}) }
  }

  /**
   * Transcreve o áudio recém-baixado, quando o modo é `auto`.
   *
   * **Nunca propaga erro.** Neste ponto o binário já está no storage e já entrou na biblioteca da
   * conversa: deixar uma falha de transcrição subir marcaria a ingestão inteira como falha, e o
   * retry do host baixaria de novo da Meta um arquivo que está salvo — gastando banda para reproduzir
   * um efeito que já aconteceu. O status fica gravado na mensagem e o `onTranscriptionDeferred`
   * avisa quem sabe reenfileirar.
   */
  private async transcribeIfAuto(context: {
    companyId: string
    message: MessageRow
    uploadId: string
    buffer: Buffer
    mimeType: string
  }): Promise<{ status: TranscriptionStatus } | undefined> {
    const transcription = this.transcription
    if (!transcription) return undefined
    // Vídeo, imagem e documento passam sem tocar no engine — checado ANTES de consultar a política,
    // para um PDF não custar uma leitura de `settings`.
    if (!isAudioMimeType(context.mimeType)) return undefined

    const policy = await transcription.resolvePolicy(context.companyId)
    if (!policy.isEnabled || policy.mode !== TRANSCRIPTION_MODE.AUTO) return undefined

    /**
     * Já transcrito, não transcreve de novo.
     *
     * Quem chega antes é normalmente o próprio host: o grafo de conversa transcreve no webhook
     * porque precisa do texto para responder ao cliente, e grava o resultado na mensagem. Sem esta
     * guarda o job de ingestão transcreveria o MESMO áudio uma segunda vez — duas cobranças e duas
     * chamadas ao engine para um resultado que já estava no banco.
     *
     * Reduz a corrida, não a elimina: host e worker podem ler `null` no mesmo instante. Aí um dos
     * dois grava por cima com o mesmo texto, o que é inofensivo — o desperdício fica na janela
     * estreita entre a gravação de um e a leitura do outro, em vez de acontecer sempre.
     *
     * A releitura é obrigatória. A linha de `context.message` foi lida no começo de `execute()`,
     * ANTES de baixar o binário da Meta — e é durante esse download que o host costuma gravar a
     * transcrição dele. Confiar na linha velha faria a guarda falhar justamente no caso comum.
     */
    const current = await transcription.messageRepository.findById(context.companyId, context.message.id)
    if (current?.transcriptionStatus === TRANSCRIPTION_STATUS.DONE) return undefined

    try {
      const result = await transcription.transcriber.transcribe({
        buffer: context.buffer,
        mimeType: context.mimeType,
        ...(transcription.languageHint ? { languageHint: transcription.languageHint } : {}),
      })

      await transcription.messageRepository.saveTranscription({
        companyId: context.companyId,
        messageId: context.message.id,
        status: TRANSCRIPTION_STATUS.DONE,
        text: result.text,
        language: result.language ?? null,
        engine: result.engine,
      })

      return { status: TRANSCRIPTION_STATUS.DONE }
    } catch (error) {
      return this.recordTranscriptionFailure(context, error)
    }
  }

  private async recordTranscriptionFailure(
    context: { companyId: string; message: MessageRow; uploadId: string },
    error: unknown,
  ): Promise<{ status: TranscriptionStatus }> {
    const status = resolveFailureStatus(error)

    await this.transcription?.messageRepository.saveTranscription({
      companyId: context.companyId,
      messageId: context.message.id,
      status,
    })

    if (status === TRANSCRIPTION_STATUS.PENDING) {
      const retryAfterSeconds = transcriptionRetryAfterSeconds(error)
      await this.transcription?.hooks?.onTranscriptionDeferred?.({
        companyId: context.companyId,
        messageId: context.message.id,
        whatsappNumber: context.message.whatsappNumber,
        uploadId: context.uploadId,
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
        reason: retryAfterSeconds !== undefined ? 'rate-limited' : 'transient-failure',
        error,
      })
    }

    return { status }
  }
}

// Extrai o descritor de mídia de uma mensagem já persistida — o webhook guarda o objeto cru da
// Meta (image/audio/video/document/sticker) no payload, e a ingestão precisa saber qual é.
export function extractMediaDescriptor(
  message: MessageRow,
): { sourceMediaId: string; mimeType: string; filename?: string } | undefined {
  const payload = (message.payload ?? {}) as Record<string, unknown>
  for (const key of ['image', 'audio', 'video', 'document', 'sticker'] as const) {
    const media = payload[key] as { id?: string; mime_type?: string; filename?: string } | undefined
    if (media?.id) {
      return {
        sourceMediaId: media.id,
        mimeType: media.mime_type ?? 'application/octet-stream',
        filename: media.filename,
      }
    }
  }
  return undefined
}
