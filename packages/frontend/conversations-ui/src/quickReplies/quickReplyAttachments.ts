import { QUICK_REPLY_ATTACHMENT_LIMIT } from './quickReply.types'
import type { QueuedAttachment, QuickReply, StoredAttachmentSendResult } from './quickReply.types'

/**
 * Anexos de uma mensagem pronta escolhida no picker, prontos para entrar na fila como `stored`
 * (QR-32). Vazio sem `hasAttachmentsCapability` — sem `sendStoredAttachments` no host, empurrar o
 * item só encalharia na fila sem jeito de sair; a linha do picker já avisou disso antes do clique.
 */
export function queuedAttachmentsFromQuickReply(
  quickReply: Pick<QuickReply, 'attachments'>,
  hasAttachmentsCapability: boolean,
): readonly QueuedAttachment[] {
  if (!hasAttachmentsCapability || !quickReply.attachments?.length) return []
  return quickReply.attachments.map(
    (attachment): QueuedAttachment => ({
      kind: 'stored',
      uploadId: attachment.uploadId,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    }),
  )
}

/** Chave estável do item na fila — `uploadId` para guardado, identidade do `File` para local. */
export function attachmentKey(item: QueuedAttachment): string {
  return item.kind === 'stored' ? item.uploadId : `local:${item.file.name}:${item.file.size}:${item.file.lastModified}`
}

export type AttachmentSendStatus = 'waiting' | 'sending' | 'sent' | 'failed'

/** Espelha os tetos da API; o host sobrescreve quando o backend dele aceita outro tamanho. */
export const DEFAULT_MAX_ATTACHMENT_SIZE_BYTES = {
  document: 100 * 1024 * 1024,
  image: 5 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
} as const

export type MaxAttachmentSizeBytes = {
  readonly document: number
  readonly image: number
  readonly audio: number
  readonly video: number
}

export type OutgoingItems = {
  readonly text: string
  readonly attachments: readonly QueuedAttachment[]
}

/**
 * Texto primeiro, depois os guardados na ordem do cadastro, por último os locais: o cliente lê a
 * explicação antes do arquivo, e o que o atendente anexou na hora é complemento do roteiro.
 */
export function orderOutgoingItems(text: string, queue: readonly QueuedAttachment[]): OutgoingItems {
  const stored = queue.filter((item) => item.kind === 'stored')
  const local = queue.filter((item) => item.kind === 'local')
  return { text, attachments: [...stored, ...local] }
}

/** Tira da fila só o que foi enviado; falha e pulado ficam para o atendente tentar de novo. */
export function applySendResults(
  queue: readonly QueuedAttachment[],
  results: readonly StoredAttachmentSendResult[],
): readonly QueuedAttachment[] {
  const sentUploadIds = new Set(results.filter((result) => result.status === 'sent').map((result) => result.uploadId))
  return queue.filter((item) => item.kind === 'local' || !sentUploadIds.has(item.uploadId))
}

export function canAddAttachments(current: number, adding: number): boolean {
  return current + adding <= QUICK_REPLY_ATTACHMENT_LIMIT
}

export function resolveMaxAttachmentSizeBytes(
  mimeType: string,
  limits: MaxAttachmentSizeBytes = DEFAULT_MAX_ATTACHMENT_SIZE_BYTES,
): number {
  if (mimeType.startsWith('image/')) return limits.image
  if (mimeType.startsWith('audio/')) return limits.audio
  if (mimeType.startsWith('video/')) return limits.video
  return limits.document
}

export type SendQueuedMessageParams = {
  readonly text: string
  readonly queue: readonly QueuedAttachment[]
  /** Uma por clique, reusada em cada tentativa de reenvio do que sobrou (QR-38). */
  readonly idempotencyKey: string
  /** Devolve se o texto saiu — falso interrompe o pipeline antes de qualquer anexo (QR-43). */
  readonly sendText: (text: string) => Promise<boolean>
  /** Ausente, itens `stored` continuam na fila — o produto não sabe mandar por referência. */
  readonly sendStoredAttachments?: (params: {
    uploadIds: readonly string[]
    idempotencyKey: string
  }) => Promise<{ results: readonly StoredAttachmentSendResult[] }>
  /** Ausente, itens `local` continuam na fila — o mesmo comportamento de hoje sem a porta. */
  readonly sendLocalAttachments?: (files: readonly File[]) => Promise<void>
  readonly onAttachmentStatus?: (key: string, status: AttachmentSendStatus) => void
}

export type SendQueuedMessageResult = {
  readonly textSent: boolean
  /** O que não foi enviado — falha, pulado ou sem porta — para o atendente tentar de novo. */
  readonly remainingQueue: readonly QueuedAttachment[]
}

/**
 * Orquestra QR-34/QR-37/QR-43: texto primeiro; se falhar, nada de anexo sai. Depois os `stored` (em
 * lote, um resultado por arquivo) e por último os `local` (sem legenda — o texto já foi mandado).
 * Pura para ser testável sem montar componente: os efeitos colaterais são só as três portas recebidas.
 */
export async function sendQueuedMessage(params: SendQueuedMessageParams): Promise<SendQueuedMessageResult> {
  const { text, queue, idempotencyKey, sendText, sendStoredAttachments, sendLocalAttachments, onAttachmentStatus } =
    params

  if (text.trim()) {
    const textSent = await sendText(text)
    if (!textSent) return { textSent: false, remainingQueue: queue }
  }

  const { attachments } = orderOutgoingItems(text, queue)
  const stored = attachments.filter(
    (item): item is Extract<QueuedAttachment, { kind: 'stored' }> => item.kind === 'stored',
  )
  const local = attachments.filter(
    (item): item is Extract<QueuedAttachment, { kind: 'local' }> => item.kind === 'local',
  )

  let results: readonly StoredAttachmentSendResult[] = []
  if (stored.length > 0 && sendStoredAttachments) {
    for (const item of stored) onAttachmentStatus?.(attachmentKey(item), 'sending')
    const response = await sendStoredAttachments({ uploadIds: stored.map((item) => item.uploadId), idempotencyKey })
    results = response.results
    for (const result of results) {
      onAttachmentStatus?.(result.uploadId, result.status === 'sent' ? 'sent' : 'failed')
    }
  }

  let remainingQueue = applySendResults(queue, results)

  if (local.length > 0 && sendLocalAttachments) {
    for (const item of local) onAttachmentStatus?.(attachmentKey(item), 'sending')
    try {
      await sendLocalAttachments(local.map((item) => item.file))
      for (const item of local) onAttachmentStatus?.(attachmentKey(item), 'sent')
      const sentKeys = new Set(local.map((item) => attachmentKey(item)))
      remainingQueue = remainingQueue.filter((item) => item.kind !== 'local' || !sentKeys.has(attachmentKey(item)))
    } catch {
      for (const item of local) onAttachmentStatus?.(attachmentKey(item), 'failed')
    }
  }

  return { textSent: true, remainingQueue }
}
