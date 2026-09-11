/**
 * "Tentar de novo" de um item avulso da fila do composer, extraído de `useComposerQueue`: local
 * volta por `onSendAttachments` sem legenda (o texto, se havia, já saiu); guardado vai sozinho por
 * `retryStoredAttachments`, com sua própria chave de idempotência (M3) — nunca a mesma do envio do
 * rascunho, porque o conjunto de `uploadId` de um retry solo é sempre outro.
 */

import { useRef } from 'react'
import {
  attachmentKey,
  resolveIdempotencyKey,
  retryStoredAttachments,
  type AttachmentSendStatus,
  type IdempotencyKeyState,
} from '../quickReplies/quickReplyAttachments'
import type { QueuedAttachment } from '../quickReplies/quickReply.types'
import type { ConversationsApi } from '../providers/types'

export type UseComposerAttachmentRetryParams = {
  readonly conversationId: string
  readonly queue: readonly QueuedAttachment[]
  readonly setQueue: (updater: (current: readonly QueuedAttachment[]) => readonly QueuedAttachment[]) => void
  readonly setAttachmentStatus: (
    updater: (current: Record<string, AttachmentSendStatus>) => Record<string, AttachmentSendStatus>,
  ) => void
  readonly setSendFailure: (message: string | undefined) => void
  readonly api: Pick<ConversationsApi, 'sendStoredAttachments'>
  readonly onSendAttachments?: (files: readonly File[], caption: string) => Promise<void>
  readonly labels: { readonly attachFailure: string }
}

export type UseComposerAttachmentRetryResult = {
  readonly retryQueuedAttachment: (item: QueuedAttachment) => void
}

export function useComposerAttachmentRetry(params: UseComposerAttachmentRetryParams): UseComposerAttachmentRetryResult {
  const { conversationId, queue, setQueue, setAttachmentStatus, setSendFailure, api, onSendAttachments, labels } =
    params
  const retryIdempotencyKeyRef = useRef<IdempotencyKeyState | undefined>(undefined)

  async function retryLocalAttachment(item: Extract<QueuedAttachment, { kind: 'local' }>): Promise<void> {
    if (!onSendAttachments) return
    const key = attachmentKey(item)
    setAttachmentStatus((current) => ({ ...current, [key]: 'sending' }))
    try {
      await onSendAttachments([item.file], '')
      setAttachmentStatus((current) => ({ ...current, [key]: 'sent' }))
      setQueue((current) => current.filter((queued) => attachmentKey(queued) !== key))
    } catch (error: unknown) {
      setAttachmentStatus((current) => ({ ...current, [key]: 'failed' }))
      setSendFailure(error instanceof Error ? error.message : labels.attachFailure)
    }
  }

  async function retryStoredAttachment(item: Extract<QueuedAttachment, { kind: 'stored' }>): Promise<void> {
    const sendStoredAttachmentsApi = api.sendStoredAttachments
    if (!sendStoredAttachmentsApi) return
    const uploadIds = [item.uploadId]
    const idempotencyState = resolveIdempotencyKey(retryIdempotencyKeyRef.current, uploadIds)
    retryIdempotencyKeyRef.current = idempotencyState
    try {
      const result = await retryStoredAttachments({
        queue,
        uploadIds,
        idempotencyKey: idempotencyState.key,
        sendStoredAttachments: (uploadParams) => sendStoredAttachmentsApi({ conversationId, ...uploadParams }),
        onAttachmentStatus: (key, status) => setAttachmentStatus((current) => ({ ...current, [key]: status })),
      })
      setQueue(() => result.remainingQueue)
    } catch (error: unknown) {
      setSendFailure(error instanceof Error ? error.message : labels.attachFailure)
    }
  }

  function retryQueuedAttachment(item: QueuedAttachment): void {
    if (item.kind === 'local') {
      void retryLocalAttachment(item)
      return
    }
    void retryStoredAttachment(item)
  }

  return { retryQueuedAttachment }
}
