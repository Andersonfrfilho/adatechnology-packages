/**
 * Fila de anexos do composer rico, extraída de `ConversationPane`: texto -> guardados -> locais
 * (QR-34/QR-43). Reseta tudo ao trocar de conversa (H2).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  attachmentKey,
  resolveIdempotencyKey,
  sendQueuedMessage,
  type AttachmentSendStatus,
  type IdempotencyKeyState,
} from '../quickReplies/quickReplyAttachments'
import { useComposerAttachmentRetry } from './useComposerAttachmentRetry'
import type { QueuedAttachment } from '../quickReplies/quickReply.types'
import type { ConversationsApi } from '../providers/types'

export type UseComposerQueueParams = {
  readonly conversationId: string
  readonly draft: string
  readonly setDraft: (value: string) => void
  readonly api: Pick<ConversationsApi, 'sendMessage' | 'sendStoredAttachments'>
  readonly labels: { readonly sendFailure: string; readonly attachFailure: string }
  readonly onSendAttachments?: (files: readonly File[], caption: string) => Promise<void>
  readonly refetch: () => Promise<void>
  readonly setSendFailure: (message: string | undefined) => void
}

export type UseComposerQueueResult = {
  readonly queue: readonly QueuedAttachment[]
  readonly enqueueAttachments: (items: readonly QueuedAttachment[]) => void
  readonly attachmentStatus: Record<string, AttachmentSendStatus>
  readonly isSendingDraft: boolean
  readonly handleRichSend: () => Promise<void>
  readonly removeQueuedAttachment: (item: QueuedAttachment) => void
  readonly retryQueuedAttachment: (item: QueuedAttachment) => void
}

export function useComposerQueue(params: UseComposerQueueParams): UseComposerQueueResult {
  const { conversationId, draft, setDraft, api, labels, onSendAttachments, refetch, setSendFailure } = params

  const [queue, setQueue] = useState<readonly QueuedAttachment[]>([])
  const [attachmentStatus, setAttachmentStatus] = useState<Record<string, AttachmentSendStatus>>({})
  const [isSendingDraft, setIsSendingDraft] = useState(false)
  /** Ref, não estado: entre dois cliques seguidos o React ainda não teria repintado a trava. */
  const sendInFlightRef = useRef(false)
  /** Uma por conjunto de `uploadId` guardado em voo (QR-38, M3); muda, `resolveIdempotencyKey` troca. */
  const idempotencyKeyRef = useRef<IdempotencyKeyState | undefined>(undefined)
  /** Espelha `conversationId` sem esperar o repaint (H2) — lido depois do `await` de um envio. */
  const currentConversationIdRef = useRef(conversationId)

  const { retryQueuedAttachment, resetRetryState } = useComposerAttachmentRetry({
    conversationId,
    currentConversationIdRef,
    queue,
    setQueue,
    setAttachmentStatus,
    setSendFailure,
    api,
    labels,
    ...(onSendAttachments ? { onSendAttachments } : {}),
  })

  // Trocar de conversa abandona o envio em andamento — senão a resposta tardia reabilitaria o
  // composer errado ou reusaria a chave de idempotência de outra thread.
  useEffect(() => {
    currentConversationIdRef.current = conversationId
    setQueue([])
    setAttachmentStatus({})
    idempotencyKeyRef.current = undefined
    sendInFlightRef.current = false
    setIsSendingDraft(false)
    resetRetryState()
  }, [conversationId, resetRetryState])

  const enqueueAttachments = useCallback((items: readonly QueuedAttachment[]) => {
    if (items.length === 0) return
    setQueue((current) => [...current, ...items])
  }, [])

  const removeQueuedAttachment = useCallback((item: QueuedAttachment) => {
    setQueue((current) => current.filter((queued) => attachmentKey(queued) !== attachmentKey(item)))
  }, [])

  /** Devolve se o envio passou: limpar o rascunho depois de uma falha apagaria o texto do operador. */
  async function runSend(action: () => Promise<unknown>, fallback: string): Promise<boolean> {
    setSendFailure(undefined)
    try {
      await action()
      await refetch()
      return true
    } catch (error: unknown) {
      setSendFailure(error instanceof Error ? error.message : fallback)
      return false
    }
  }

  /** Fila só com `local`, como antes da feature de guardados: uma chamada só, rascunho como legenda. */
  async function sendLocalOnlyAttachments(isSameConversation: () => boolean): Promise<void> {
    if (!onSendAttachments) return
    const files = queue
      .filter((item): item is Extract<QueuedAttachment, { kind: 'local' }> => item.kind === 'local')
      .map((item) => item.file)
    try {
      const didSend = await runSend(() => onSendAttachments(files, draft), labels.attachFailure)
      if (!isSameConversation()) return
      if (didSend) {
        setQueue([])
        setAttachmentStatus({})
        idempotencyKeyRef.current = undefined
        setDraft('')
      }
    } finally {
      if (isSameConversation()) {
        sendInFlightRef.current = false
        setIsSendingDraft(false)
      }
    }
  }

  /** Texto -> guardados (lote, um resultado por arquivo) -> locais. Só o que não saiu continua na fila. */
  async function sendQueuedDraft(isSameConversation: () => boolean): Promise<void> {
    const sendStoredAttachmentsApi = api.sendStoredAttachments
    const storedUploadIds = queue
      .filter((item): item is Extract<QueuedAttachment, { kind: 'stored' }> => item.kind === 'stored')
      .map((item) => item.uploadId)
    const idempotencyState = resolveIdempotencyKey(idempotencyKeyRef.current, storedUploadIds)
    idempotencyKeyRef.current = idempotencyState
    try {
      const result = await sendQueuedMessage({
        text: draft,
        queue,
        idempotencyKey: idempotencyState.key,
        sendText: (text) => runSend(() => api.sendMessage(conversationId, text), labels.sendFailure),
        ...(sendStoredAttachmentsApi
          ? {
              sendStoredAttachments: (uploadParams: { uploadIds: readonly string[]; idempotencyKey: string }) =>
                sendStoredAttachmentsApi({ conversationId, ...uploadParams }),
            }
          : {}),
        ...(onSendAttachments
          ? { sendLocalAttachments: (files: readonly File[]) => onSendAttachments(files, '') }
          : {}),
        onAttachmentStatus: (key, status) => {
          if (isSameConversation()) setAttachmentStatus((current) => ({ ...current, [key]: status }))
        },
      })
      if (!isSameConversation()) return
      // `runSend` já gravou o erro específico do texto (`setSendFailure`) — não sobrescrever com o
      // rótulo genérico.
      if (!result.textSent) return
      // Filtra por chave sobre a fila CORRENTE, não sobrescreve com `result.remainingQueue` (que foi
      // calculado sobre a fila capturada antes do `await` e perderia item adicionado durante o envio).
      const sentKeys = new Set(result.sentAttachmentKeys)
      setQueue((current) => current.filter((item) => !sentKeys.has(attachmentKey(item))))
      if (result.remainingQueue.length === 0) {
        idempotencyKeyRef.current = undefined
        setAttachmentStatus({})
      }
      if (draft.trim()) setDraft('')
      await refetch()
    } catch (error: unknown) {
      if (isSameConversation()) setSendFailure(error instanceof Error ? error.message : labels.attachFailure)
    } finally {
      if (isSameConversation()) {
        sendInFlightRef.current = false
        setIsSendingDraft(false)
      }
    }
  }

  /** Texto primeiro; se falhar, nenhum anexo sai (QR-34, QR-43). Só o que não saiu continua na fila. */
  async function handleRichSend(): Promise<void> {
    // Trava contra clique duplo / Enter impaciente enquanto o upload está em voo.
    if (sendInFlightRef.current) return
    if (!draft.trim() && queue.length === 0) return
    sendInFlightRef.current = true
    setIsSendingDraft(true)
    setSendFailure(undefined)
    // Capturado antes do primeiro `await` (H2) — ver `currentConversationIdRef`.
    const conversationIdAtSend = conversationId
    const isSameConversation = (): boolean => currentConversationIdRef.current === conversationIdAtSend

    // QR-32/QR-33: só `stored` (mensagem pronta) vai pelo pipeline novo; só `local` fica no antigo.
    const hasStoredItems = queue.some((item) => item.kind === 'stored')
    if (onSendAttachments && queue.length > 0 && !hasStoredItems) {
      await sendLocalOnlyAttachments(isSameConversation)
      return
    }
    await sendQueuedDraft(isSameConversation)
  }

  return {
    queue,
    enqueueAttachments,
    attachmentStatus,
    isSendingDraft,
    handleRichSend,
    removeQueuedAttachment,
    retryQueuedAttachment,
  }
}
