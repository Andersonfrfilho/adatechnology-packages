/**
 * Arquivos trocados na conversa. Sai do transcript e vira lista própria porque anexo é o que o
 * atendente mais precisa reencontrar depois — rolar meses de mensagens para achar um comprovante é
 * o caso que a busca por documento existe para eliminar.
 *
 * Usa `useConversationDocuments`, então funciona com qualquer `ConversationsApi`. Host sem
 * biblioteca de documentos cai no estado vazio, sem quebrar.
 */

import { useState } from 'react'
import { useConversationDocuments } from './hooks/useConversationDocuments'
import { useConversations } from './providers/ConversationsProvider'
import { FileIcon } from './FileIcon'
import { cn } from './lib/cn'
import { formatFileSize, formatTimestamp } from './lib/format'

export interface ConversationDocumentsPanelLabels {
  toggle: string
  title: string
  searchPlaceholder: string
  empty: string
  loading: string
  failure: string
  download: string
}

export const DEFAULT_CONVERSATION_DOCUMENTS_LABELS: ConversationDocumentsPanelLabels = {
  toggle: '📎 Arquivos',
  title: 'Arquivos da conversa',
  searchPlaceholder: 'Buscar arquivo...',
  empty: 'Nenhum arquivo nesta conversa.',
  loading: 'Carregando arquivos…',
  failure: 'Não foi possível carregar os arquivos.',
  download: 'Baixar',
}

export interface ConversationDocumentsPanelClassNames {
  root: string
  body: string
}

export interface ConversationDocumentsPanelProps {
  conversationId: string
  /** Controlado de fora porque o gatilho vive no cabeçalho, junto das outras ações da conversa. */
  open: boolean
  labels?: Partial<ConversationDocumentsPanelLabels>
  className?: string
  classNames?: Partial<ConversationDocumentsPanelClassNames>
}

export function ConversationDocumentsPanel({
  conversationId,
  open,
  labels: labelsOverride,
  className,
  classNames,
}: ConversationDocumentsPanelProps) {
  const labels = { ...DEFAULT_CONVERSATION_DOCUMENTS_LABELS, ...labelsOverride }
  const context = useConversations()
  const [search, setSearch] = useState('')

  // Só busca quando o painel abre: a lista de anexos é consulta extra e não deve pesar em toda
  // conversa aberta.
  const { documents, loading, error } = useConversationDocuments(open ? conversationId : undefined, { search })

  async function handleDownload(uploadId: string): Promise<void> {
    const url = await context?.api.getDocumentUrl(uploadId)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!open) return null

  return (
    <div className={cn('border-b', classNames?.root, className)}>
      <section className={cn('px-4 py-3', classNames?.body)}>
          <p className="mb-2 text-sm font-medium">{labels.title}</p>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={labels.searchPlaceholder}
            className="mb-2 w-full rounded-md border px-3 py-2 text-sm"
          />

          {loading ? <p className="text-xs text-gray-500">{labels.loading}</p> : null}
          {error ? <p className="text-xs text-red-600 dark:text-red-400">{labels.failure}</p> : null}
          {!loading && !error && documents.length === 0 ? (
            <p className="text-xs text-gray-500">{labels.empty}</p>
          ) : null}

          <ul className="space-y-1">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center gap-2 text-xs">
                <FileIcon mimeType={document.mimeType} />
                <span className="min-w-0 flex-1 truncate">{document.filename}</span>
                <span className="text-gray-500">{formatFileSize(document.sizeBytes)}</span>
                <span className="text-gray-500">{formatTimestamp(document.linkedAt)}</span>
                <button type="button" onClick={() => void handleDownload(document.id)} className="cv-header-action">
                  {labels.download}
                </button>
              </li>
            ))}
          </ul>
      </section>
    </div>
  )
}
