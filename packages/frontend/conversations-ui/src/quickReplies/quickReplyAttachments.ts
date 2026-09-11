import { QUICK_REPLY_ATTACHMENT_LIMIT } from './quickReply.types'
import type { QueuedAttachment, StoredAttachmentSendResult } from './quickReply.types'

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
