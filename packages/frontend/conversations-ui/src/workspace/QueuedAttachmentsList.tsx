/**
 * Fila de anexos do composer — itens `local` (ainda não subiram) e `stored` (mensagem pronta,
 * enviados por referência). Mostra nome, tipo, tamanho, miniatura de imagem sob demanda e o estado
 * de envio de cada item (QR-32, QR-33, QR-47).
 */

import { useEffect, useState } from 'react'

import { formatFileSize } from '../lib/format'
import { attachmentKey, type AttachmentSendStatus } from '../quickReplies/quickReplyAttachments'
import type { QueuedAttachment } from '../quickReplies/quickReply.types'

export type QueuedAttachmentsListLabels = {
  readonly remove: string
  readonly waiting: string
  readonly sending: string
  readonly sent: string
  readonly failed: string
  readonly retry: string
}

export type QueuedAttachmentsListProps = {
  readonly items: readonly QueuedAttachment[]
  readonly statusOf: (key: string) => AttachmentSendStatus
  readonly onRemove: (item: QueuedAttachment) => void
  readonly onRetry?: (item: QueuedAttachment) => void
  readonly getThumbnailUrl?: (uploadId: string) => Promise<string>
  readonly labels: QueuedAttachmentsListLabels
  readonly busy: boolean
}

function nameOf(item: QueuedAttachment): string {
  return item.kind === 'local' ? item.file.name : item.filename
}

function mimeTypeOf(item: QueuedAttachment): string {
  return item.kind === 'local' ? item.file.type : item.mimeType
}

function sizeOf(item: QueuedAttachment): number {
  return item.kind === 'local' ? item.file.size : item.sizeBytes
}

/** Espaço reservado do tamanho final enquanto a miniatura carrega — sem pulo de layout (QR-47). */
function AttachmentThumbnail({
  item,
  getThumbnailUrl,
}: {
  readonly item: QueuedAttachment
  readonly getThumbnailUrl?: (uploadId: string) => Promise<string>
}) {
  const isImage = mimeTypeOf(item).startsWith('image/')
  const [url, setUrl] = useState<string | undefined>(item.kind === 'local' ? undefined : item.previewUrl)
  const localFile = item.kind === 'local' ? item.file : undefined
  const uploadId = item.kind === 'stored' ? item.uploadId : undefined

  // Só o `File` decide a URL de objeto local: incluir `item` inteiro (H4) recriava e revogava a URL
  // a cada render em que a identidade do objeto da fila mudasse por outro motivo (status, por ex.).
  useEffect(() => {
    if (!isImage || !localFile) return
    const objectUrl = URL.createObjectURL(localFile)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [isImage, localFile])

  // `url` fica de fora do array por propósito: é este efeito que o define via `setUrl`, incluí-lo
  // reexecutaria a busca a cada resolução. Só `uploadId` reinicia a busca da miniatura remota.
  useEffect(() => {
    if (!isImage || !uploadId || !getThumbnailUrl) return
    let cancelled = false
    getThumbnailUrl(uploadId)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [isImage, uploadId, getThumbnailUrl])

  if (!isImage) return null
  return (
    <span className="cv-attachment-item__thumbnail" aria-hidden="true">
      {url ? <img src={url} alt="" /> : null}
    </span>
  )
}

/** Mantém o item visível por uma transição curta depois de sair da fila (QR-47), sem travar props. */
function useDepartingItems(items: readonly QueuedAttachment[]) {
  const [rendered, setRendered] = useState(items)
  const [departingKeys, setDepartingKeys] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const currentKeys = new Set(items.map(attachmentKey))
    const removedItems = rendered.filter((item) => !currentKeys.has(attachmentKey(item)))
    if (removedItems.length === 0) {
      setRendered(items)
      return
    }
    setDepartingKeys(new Set(removedItems.map(attachmentKey)))
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const delay = reduceMotion ? 0 : 220
    const timer = setTimeout(() => {
      setRendered(items)
      setDepartingKeys(new Set())
    }, delay)
    return () => clearTimeout(timer)
    // `rendered` fica de fora do array por propósito: é o próprio efeito que o atualiza (via
    // `setRendered`), então incluí-lo recriaria o timer em loop — só a fila vinda de fora (`items`)
    // deve reiniciar a transição de saída.
  }, [items])

  return { rendered: departingKeys.size > 0 ? [...rendered] : items, departingKeys }
}

export function QueuedAttachmentsList({
  items,
  statusOf,
  onRemove,
  onRetry,
  getThumbnailUrl,
  labels,
  busy,
}: QueuedAttachmentsListProps) {
  const { rendered, departingKeys } = useDepartingItems(items)
  if (rendered.length === 0) return null

  const statusLabelOf = (status: AttachmentSendStatus): string => {
    if (status === 'sending') return labels.sending
    if (status === 'sent') return labels.sent
    if (status === 'failed') return labels.failed
    return labels.waiting
  }

  return (
    <ul className="cv-workspace-attachments" aria-busy={busy} aria-live="polite">
      {rendered.map((item) => {
        const key = attachmentKey(item)
        const status = statusOf(key)
        const isDeparting = departingKeys.has(key)
        return (
          <li
            key={key}
            className={`cv-attachment-item cv-attachment-item--${status}${isDeparting ? ' cv-attachment-item--departing' : ''}`}
          >
            <AttachmentThumbnail item={item} getThumbnailUrl={getThumbnailUrl} />
            <span className="cv-attachment-item__info">
              <span className="cv-attachment-item__name">{nameOf(item)}</span>
              <span className="cv-attachment-item__meta">
                {formatFileSize(sizeOf(item))} · {statusLabelOf(status)}
              </span>
            </span>
            {status === 'failed' && onRetry ? (
              <button type="button" className="cv-attachment-item__retry" onClick={() => onRetry(item)}>
                {labels.retry}
              </button>
            ) : null}
            <button
              data-cv-tooltip={labels.remove}
              type="button"
              aria-label={labels.remove}
              disabled={status === 'sending'}
              onClick={() => onRemove(item)}
            >
              ✕
            </button>
          </li>
        )
      })}
    </ul>
  )
}
