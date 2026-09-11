/**
 * "Tentar de novo" de um item avulso da fila do composer, extraído de `useComposerQueue`: local
 * volta por `onSendAttachments` sem legenda (o texto, se havia, já saiu); guardado vai sozinho por
 * `retryStoredAttachments`, com sua própria chave de idempotência (M3) — nunca a mesma do envio do
 * rascunho, porque o conjunto de `uploadId` de um retry solo é sempre outro.
 *
 * Guarda de troca de conversa (H2): `ConversationPane` fica montado ao trocar de conversa, então um
 * retry que resolve depois da troca não pode gravar na fila/estado da conversa nova com dado da
 * antiga. O id da conversa é capturado antes do primeiro `await` e comparado com
 * `currentConversationIdRef` (espelhado por `useComposerQueue`) depois; troca no meio, o resultado é
 * descartado. Trava por chave (não a trava global do rascunho) impede duplo clique de reenviar o
 * mesmo item duas vezes.
 */

import { useCallback, useRef, useState } from 'react'
import {
  attachmentKey,
  resolveIdempotencyKey,
  resolveRetryOutcome,
  retryStoredAttachments,
  type AttachmentSendStatus,
  type IdempotencyKeyState,
} from '../quickReplies/quickReplyAttachments'
import type { QueuedAttachment } from '../quickReplies/quickReply.types'
import type { ConversationsApi } from '../providers/types'

export type UseComposerAttachmentRetryParams = {
  readonly conversationId: string
  readonly currentConversationIdRef: { readonly current: string }
  readonly queue: readonly QueuedAttachment[]
  readonly setQueue: (updater: (current: readonly QueuedAttachment[]) => readonly QueuedAttachment[]) => void
  readonly setAttachmentStatus: (
    updater: (current: Record<string, AttachmentSendStatus>) => Record<string, AttachmentSendStatus>,
  ) => void
  readonly setSendFailure: (message: string | undefined) => void
  readonly api: Pick<ConversationsApi, 'sendStoredAttachments'>
  readonly onSendAttachments?: (files: readonly File[], caption: string) => Promise<void>
  readonly labels: { readonly attachFailure: string }
  /** Espelha o envio completo do rascunho (`useComposerQueue`): um retry avulso não pode disparar
   * enquanto o composer inteiro está em voo — as duas chaves de idempotência colidiriam no mesmo item. */
  readonly sendInFlightRef: { readonly current: boolean }
}

export type UseComposerAttachmentRetryResult = {
  readonly retryQueuedAttachment: (item: QueuedAttachment) => void
  /** Chamado por `useComposerQueue` ao trocar de conversa: descarta chave de idempotência e travas. */
  readonly resetRetryState: () => void
  /** Chaves com retry avulso em voo — `useComposerQueue` exclui estas de um envio completo (evita
   * duplo envio do mesmo item), e a UI desabilita o botão "Tentar de novo" enquanto durar. */
  readonly retryingKeys: ReadonlySet<string>
}

export function useComposerAttachmentRetry(params: UseComposerAttachmentRetryParams): UseComposerAttachmentRetryResult {
  const {
    conversationId,
    currentConversationIdRef,
    queue,
    setQueue,
    setAttachmentStatus,
    setSendFailure,
    api,
    onSendAttachments,
    labels,
    sendInFlightRef,
  } = params
  const retryIdempotencyKeyRef = useRef<IdempotencyKeyState | undefined>(undefined)
  /** Chaves com retry em voo — impede duplo clique de reenviar o mesmo item duas vezes. */
  const retryingKeysRef = useRef<Set<string>>(new Set())
  /** Espelho reativo de `retryingKeysRef` — o ref sozinho não repinta o botão desabilitado. */
  const [retryingKeys, setRetryingKeys] = useState<ReadonlySet<string>>(new Set())

  function markRetrying(key: string): void {
    retryingKeysRef.current.add(key)
    setRetryingKeys(new Set(retryingKeysRef.current))
  }

  function unmarkRetrying(key: string): void {
    retryingKeysRef.current.delete(key)
    setRetryingKeys(new Set(retryingKeysRef.current))
  }

  async function retryLocalAttachment(item: Extract<QueuedAttachment, { kind: 'local' }>): Promise<void> {
    if (!onSendAttachments) return
    const key = attachmentKey(item)
    const conversationIdAtRetry = conversationId
    const isSameConversation = (): boolean => currentConversationIdRef.current === conversationIdAtRetry
    setAttachmentStatus((current) => ({ ...current, [key]: 'sending' }))
    try {
      await onSendAttachments([item.file], '')
      if (!isSameConversation()) return
      setAttachmentStatus((current) => ({ ...current, [key]: 'sent' }))
      setQueue((current) => current.filter((queued) => attachmentKey(queued) !== key))
    } catch (error: unknown) {
      if (!isSameConversation()) return
      setAttachmentStatus((current) => ({ ...current, [key]: 'failed' }))
      setSendFailure(error instanceof Error ? error.message : labels.attachFailure)
    }
  }

  async function retryStoredAttachment(item: Extract<QueuedAttachment, { kind: 'stored' }>): Promise<void> {
    const sendStoredAttachmentsApi = api.sendStoredAttachments
    if (!sendStoredAttachmentsApi) return
    const conversationIdAtRetry = conversationId
    const isSameConversation = (): boolean => currentConversationIdRef.current === conversationIdAtRetry
    const uploadIds = [item.uploadId]
    const idempotencyState = resolveIdempotencyKey(retryIdempotencyKeyRef.current, uploadIds)
    retryIdempotencyKeyRef.current = idempotencyState
    try {
      const result = await retryStoredAttachments({
        queue,
        uploadIds,
        idempotencyKey: idempotencyState.key,
        sendStoredAttachments: (uploadParams) =>
          sendStoredAttachmentsApi({ conversationId: conversationIdAtRetry, ...uploadParams }),
        onAttachmentStatus: (statusKey, status) => {
          if (isSameConversation()) setAttachmentStatus((current) => ({ ...current, [statusKey]: status }))
        },
      })
      setQueue(
        (current) =>
          resolveRetryOutcome({
            conversationIdAtRetry,
            currentConversationId: currentConversationIdRef.current,
            sentAttachmentKeys: result.sentAttachmentKeys,
            queue: current,
          }) ?? current,
      )
    } catch (error: unknown) {
      if (isSameConversation()) setSendFailure(error instanceof Error ? error.message : labels.attachFailure)
    }
  }

  function retryQueuedAttachment(item: QueuedAttachment): void {
    // Um envio completo já está em voo — deixá-lo terminar antes de aceitar retry avulso, senão as
    // duas chaves de idempotência disputam o mesmo item.
    if (sendInFlightRef.current) return
    const key = attachmentKey(item)
    if (retryingKeysRef.current.has(key)) return
    markRetrying(key)
    const release = (): void => unmarkRetrying(key)
    if (item.kind === 'local') {
      void retryLocalAttachment(item).finally(release)
      return
    }
    void retryStoredAttachment(item).finally(release)
  }

  const resetRetryState = useCallback((): void => {
    retryIdempotencyKeyRef.current = undefined
    retryingKeysRef.current.clear()
    setRetryingKeys(new Set())
  }, [])

  return { retryQueuedAttachment, resetRetryState, retryingKeys }
}
