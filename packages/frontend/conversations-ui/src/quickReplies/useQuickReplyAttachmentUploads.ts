/**
 * Fila de upload de anexo do formulário de cadastro (QR-31/M1), extraída de
 * `useQuickRepliesWorkspace`: até 3 uploads em voo por vez, progresso real por arquivo, e
 * cancelamento de tudo ao trocar de registro (M2) sem `setState` órfão depois do unmount.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createUploadQueue } from './createUploadQueue'
import { validateAttachmentFiles, type AttachmentFileRejection } from './quickReplyAttachmentUpload'
import type { MaxAttachmentSizeBytes } from './quickReplyAttachments'
import type { QuickReplyAttachment } from './quickReply.types'
import type { QuickRepliesWorkspaceLabels } from './labels'

/** Item em upload no formulário: estado local, nunca persistido — some ao terminar ou ser removido. */
export type PendingAttachmentUpload = {
  readonly localId: string
  readonly file: File
  readonly status: 'uploading' | 'error'
  readonly progress: number
  readonly error?: string
}

export type UseQuickReplyAttachmentUploadsParams = {
  readonly upload?: (
    file: File,
    options?: { onProgress?: (fraction: number) => void; signal?: AbortSignal },
  ) => Promise<QuickReplyAttachment>
  readonly labels: QuickRepliesWorkspaceLabels
  /** Sobrescreve o teto por tipo de arquivo. Ausente, usa `DEFAULT_MAX_ATTACHMENT_SIZE_BYTES`. */
  readonly attachmentSizeLimits?: MaxAttachmentSizeBytes
  /** Quantos anexos já confirmados (`editing.attachments.length`) — entra no teto de 10 (QR-31). */
  readonly attachmentsCount: number
  /** Onde o item entra assim que o upload resolve — o hook não sabe de `editing`, só devolve o resultado. */
  readonly onUploaded: (attachment: QuickReplyAttachment) => void
}

export type UseQuickReplyAttachmentUploadsResult = {
  readonly pendingUploads: readonly PendingAttachmentUpload[]
  readonly attachmentRejections: readonly AttachmentFileRejection[]
  readonly addAttachmentFiles: (files: FileList | readonly File[]) => void
  readonly retryAttachmentUpload: (localId: string) => void
  readonly cancelAttachmentUpload: (localId: string) => void
  readonly dismissAttachmentRejections: () => void
  /** Cancela todo upload em voo — trocar de registro sem isso deixaria um `fetch` órfão terminando
   * sozinho e tentando atualizar um estado que já não existe mais. */
  readonly abortAllUploads: () => void
}

/** Estado e orquestração do upload de anexo — sem saber de `editing`, só de arquivos e resultado. */
export function useQuickReplyAttachmentUploads({
  upload,
  labels,
  attachmentSizeLimits,
  attachmentsCount,
  onUploaded,
}: UseQuickReplyAttachmentUploadsParams): UseQuickReplyAttachmentUploadsResult {
  const [pendingUploads, setPendingUploads] = useState<readonly PendingAttachmentUpload[]>([])
  const [attachmentRejections, setAttachmentRejections] = useState<readonly AttachmentFileRejection[]>([])
  /** Fila compartilhada (M1): no máximo 3 uploads em voo ao mesmo tempo, somando o que
   * `addAttachmentFiles` e `retryAttachmentUpload` enfileiram — nenhum dos dois abre janela própria. */
  const uploadQueueRef = useRef(createUploadQueue(3))
  /** M2: depois do unmount, nenhuma promessa de upload em voo pode chamar setState — só aborta. */
  const isMountedRef = useRef(true)

  useEffect(
    () => () => {
      isMountedRef.current = false
      uploadQueueRef.current.abortAll()
    },
    [],
  )

  const abortAllUploads = useCallback(() => {
    uploadQueueRef.current.abortAll()
    setPendingUploads([])
  }, [])

  const dismissAttachmentRejections = useCallback(() => setAttachmentRejections([]), [])

  const cancelAttachmentUpload = useCallback((localId: string) => {
    uploadQueueRef.current.abort(localId)
    setPendingUploads((current) => current.filter((item) => item.localId !== localId))
  }, [])

  const updatePendingUpload = useCallback((localId: string, patch: Partial<PendingAttachmentUpload>) => {
    setPendingUploads((current) => current.map((item) => (item.localId === localId ? { ...item, ...patch } : item)))
  }, [])

  /** Sobe um arquivo já validado, através da fila compartilhada (M1): progresso real por
   * `onProgress`, e o resultado vira `onUploaded` na ordem de chegada assim que a promessa
   * resolve. Enfileira e retorna — quem chama não espera. */
  const uploadOneFile = useCallback(
    (localId: string, file: File) => {
      if (!upload) return
      uploadQueueRef.current.enqueue(localId, async (signal) => {
        try {
          const attachment = await upload(file, {
            onProgress: (fraction) => {
              if (isMountedRef.current) updatePendingUpload(localId, { progress: fraction })
            },
            signal,
          })
          if (!isMountedRef.current) return
          onUploaded(attachment)
          setPendingUploads((current) => current.filter((item) => item.localId !== localId))
        } catch (caught: unknown) {
          if (signal.aborted || !isMountedRef.current) return
          updatePendingUpload(localId, {
            status: 'error',
            error: caught instanceof Error ? caught.message : labels.saveError,
          })
        }
      })
    },
    [upload, updatePendingUpload, onUploaded, labels.saveError],
  )

  const retryAttachmentUpload = useCallback(
    (localId: string) => {
      const item = pendingUploads.find((pending) => pending.localId === localId)
      if (!item) return
      updatePendingUpload(localId, { status: 'uploading', progress: 0, error: undefined })
      uploadOneFile(localId, item.file)
    },
    [pendingUploads, updatePendingUpload, uploadOneFile],
  )

  /** Valida (teto de 10, tamanho por tipo) ANTES de subir (QR-31) — só o aceito vira upload; o
   * recusado fica em `attachmentRejections` para a tela explicar por quê, sem gastar rede nele. */
  const addAttachmentFiles = useCallback(
    (files: FileList | readonly File[]) => {
      if (!upload) return
      const currentCount = attachmentsCount + pendingUploads.length
      const { accepted, rejected } = validateAttachmentFiles(Array.from(files), currentCount, attachmentSizeLimits)
      setAttachmentRejections(rejected)
      if (accepted.length === 0) return
      const newItems: PendingAttachmentUpload[] = accepted.map((file) => ({
        localId: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        status: 'uploading',
        progress: 0,
      }))
      setPendingUploads((current) => [...current, ...newItems])
      // Até 3 em paralelo (QR-31), somando com retries em voo — a fila compartilhada decide (M1).
      for (const item of newItems) uploadOneFile(item.localId, item.file)
    },
    [upload, attachmentsCount, pendingUploads.length, uploadOneFile, attachmentSizeLimits],
  )

  return {
    pendingUploads,
    attachmentRejections,
    addAttachmentFiles,
    retryAttachmentUpload,
    cancelAttachmentUpload,
    dismissAttachmentRejections,
    abortAllUploads,
  }
}
