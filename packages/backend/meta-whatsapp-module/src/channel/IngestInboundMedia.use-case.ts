import { eq, and } from 'drizzle-orm'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres'
import type { AnyRelations, EmptyRelations } from 'drizzle-orm/relations'
import type { ChannelAdapterInterface, ObjectStorageInterface } from '@adatechnology/meta-whatsapp-contracts'
import { messages, type MessageRow } from '../schema/schema'

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
    private readonly db: BunSQLDatabase<AnyRelations | EmptyRelations>,
    private readonly channel: ChannelAdapterInterface,
    private readonly objectStorage: ObjectStorageInterface,
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
      ...(params.filename ? { filename: params.filename } : {}),
    }

    await this.db
      .update(messages)
      .set({ payload: updatedPayload })
      .where(and(eq(messages.companyId, params.companyId), eq(messages.id, params.messageId)))

    return { uploadId, alreadyIngested: false }
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
