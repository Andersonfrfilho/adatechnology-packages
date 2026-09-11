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

/**
 * Chave estável do item na fila — `uploadId` para guardado, `localId` gerado para local. A
 * identidade do `File` (nome+tamanho+data) não bastava: duas cópias do mesmo arquivo colidiam na
 * mesma chave e removê-la de uma removia as duas.
 */
export function attachmentKey(item: QueuedAttachment): string {
  return item.kind === 'stored' ? item.uploadId : item.localId
}

export type AttachmentSendStatus = 'waiting' | 'sending' | 'sent' | 'failed' | 'skipped'

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

export type IdempotencyKeyState = {
  readonly key: string
  /** Conjunto ORDENADO de `uploadId` desta tentativa — a chave só sobrevive enquanto for igual. */
  readonly uploadIds: readonly string[]
}

/**
 * Decide se a chave de idempotência de `previous` ainda serve (M3): serve quando o conjunto
 * ORDENADO de `uploadIds` não mudou desde a tentativa anterior. Mudou — um anexo saiu, entrou, ou
 * trocou de posição — vira uma tentativa diferente perante o backend, e precisa de chave nova; a
 * mesma chave reenviaria o lote antigo como se fosse o novo (ou o servidor recusaria por conflito).
 */
export function resolveIdempotencyKey(
  previous: IdempotencyKeyState | undefined,
  uploadIds: readonly string[],
  generateKey: () => string = () => crypto.randomUUID(),
): IdempotencyKeyState {
  if (previous && sameUploadIds(previous.uploadIds, uploadIds)) return previous
  return { key: generateKey(), uploadIds }
}

function sameUploadIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((id, index) => id === b[index])
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
  /** Chaves (`attachmentKey`) dos itens que saíram — para o chamador remover por chave de um estado
   * corrente, em vez de sobrescrever a fila com este `remainingQueue` (calculado sobre uma fila
   * capturada antes do `await`, que já pode estar desatualizada). */
  readonly sentAttachmentKeys: readonly string[]
}

type SendStoredAttachmentsPort = NonNullable<SendQueuedMessageParams['sendStoredAttachments']>
type StoredQueuedAttachment = Extract<QueuedAttachment, { kind: 'stored' }>

/** Traduz o status do resultado do servidor para o status visual do item na fila. */
function attachmentSendStatusOf(status: StoredAttachmentSendResult['status']): AttachmentSendStatus {
  if (status === 'sent') return 'sent'
  if (status === 'skipped') return 'skipped'
  return 'failed'
}

/**
 * Manda um lote de itens `stored` e traduz a resposta em status por item — usado tanto pelo envio
 * normal quanto pelo retry avulso (M5): guardado sem resultado no lote é tratado como falha, e o
 * lote inteiro falhando (rede, 500) marca cada item como falha em vez de sumir da tela sem explicação.
 * `skipped` (o servidor parou antes de tentar este arquivo, por causa de uma falha anterior no
 * mesmo lote) fica distinto de `failed` — o item não falhou, só não chegou a ser tentado.
 */
async function sendStoredBatch(
  stored: readonly StoredQueuedAttachment[],
  idempotencyKey: string,
  sendStoredAttachments: SendStoredAttachmentsPort,
  onAttachmentStatus?: (key: string, status: AttachmentSendStatus) => void,
): Promise<readonly StoredAttachmentSendResult[]> {
  for (const item of stored) onAttachmentStatus?.(attachmentKey(item), 'sending')
  try {
    const response = await sendStoredAttachments({ uploadIds: stored.map((item) => item.uploadId), idempotencyKey })
    let results = response.results
    const resultedUploadIds = new Set(results.map((result) => result.uploadId))
    for (const item of stored) {
      if (!resultedUploadIds.has(item.uploadId)) results = [...results, { uploadId: item.uploadId, status: 'failed' }]
    }
    for (const result of results) {
      onAttachmentStatus?.(result.uploadId, attachmentSendStatusOf(result.status))
    }
    return results
  } catch {
    for (const item of stored) onAttachmentStatus?.(attachmentKey(item), 'failed')
    return stored.map((item) => ({ uploadId: item.uploadId, status: 'failed' as const }))
  }
}

export type RetryStoredAttachmentsParams = {
  readonly queue: readonly QueuedAttachment[]
  /** Só este subconjunto é reenviado — o resto da fila (texto já mandado) fica intocado. */
  readonly uploadIds: readonly string[]
  readonly idempotencyKey: string
  readonly sendStoredAttachments: SendStoredAttachmentsPort
  readonly onAttachmentStatus?: (key: string, status: AttachmentSendStatus) => void
}

export type RetryStoredAttachmentsResult = {
  readonly remainingQueue: readonly QueuedAttachment[]
  /** Chaves (`uploadId`) dos itens que saíram — ver `SendQueuedMessageResult.sentAttachmentKeys`. */
  readonly sentAttachmentKeys: readonly string[]
}

/**
 * Reenvia só os `stored` de `uploadIds` — nunca o texto do rascunho (M3): o botão "Tentar de novo"
 * de um item é sobre aquele anexo, não sobre a mensagem inteira que já foi lida ou já saiu.
 */
export async function retryStoredAttachments(
  params: RetryStoredAttachmentsParams,
): Promise<RetryStoredAttachmentsResult> {
  const { queue, uploadIds, idempotencyKey, sendStoredAttachments, onAttachmentStatus } = params
  const targetIds = new Set(uploadIds)
  const targets = queue.filter(
    (item): item is StoredQueuedAttachment => item.kind === 'stored' && targetIds.has(item.uploadId),
  )
  if (targets.length === 0) return { remainingQueue: queue, sentAttachmentKeys: [] }
  const results = await sendStoredBatch(targets, idempotencyKey, sendStoredAttachments, onAttachmentStatus)
  const sentAttachmentKeys = results.filter((result) => result.status === 'sent').map((result) => result.uploadId)
  return { remainingQueue: applySendResults(queue, results), sentAttachmentKeys }
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
    if (!textSent) return { textSent: false, remainingQueue: queue, sentAttachmentKeys: [] }
  }

  const { attachments } = orderOutgoingItems(text, queue)
  const stored = attachments.filter((item): item is StoredQueuedAttachment => item.kind === 'stored')
  const local = attachments.filter(
    (item): item is Extract<QueuedAttachment, { kind: 'local' }> => item.kind === 'local',
  )

  const results =
    stored.length > 0 && sendStoredAttachments
      ? await sendStoredBatch(stored, idempotencyKey, sendStoredAttachments, onAttachmentStatus)
      : []

  let remainingQueue = applySendResults(queue, results)
  const sentAttachmentKeys = results.filter((result) => result.status === 'sent').map((result) => result.uploadId)

  if (local.length > 0 && sendLocalAttachments) {
    for (const item of local) onAttachmentStatus?.(attachmentKey(item), 'sending')
    try {
      await sendLocalAttachments(local.map((item) => item.file))
      for (const item of local) onAttachmentStatus?.(attachmentKey(item), 'sent')
      const sentKeys = new Set(local.map((item) => attachmentKey(item)))
      remainingQueue = remainingQueue.filter((item) => item.kind !== 'local' || !sentKeys.has(attachmentKey(item)))
      sentAttachmentKeys.push(...sentKeys)
    } catch {
      for (const item of local) onAttachmentStatus?.(attachmentKey(item), 'failed')
    }
  }

  return { textSent: true, remainingQueue, sentAttachmentKeys }
}
