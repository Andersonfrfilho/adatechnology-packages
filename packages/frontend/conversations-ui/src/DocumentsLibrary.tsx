/**
 * Biblioteca de arquivos de TODAS as conversas — a tela de Documentos do painel, fora do
 * atendimento.
 *
 * Distinta do `ConversationDocumentsPanel`: aquele parte de uma conversa aberta e vive dentro dela;
 * esta varre a empresa e por isso mostra de qual conversa cada arquivo veio, com o número
 * clicável. Sem essa referência, uma lista global de anexos não responde nenhuma pergunta.
 */

import { useEffect, useState } from 'react'
import { ArrowUpDown, Bot, Download, Eye, MessageSquare, Users } from 'lucide-react'
import { useConversations } from './providers/ConversationsProvider'
import { DOCUMENT_SOURCE_FILTER, type DocumentSourceFilter } from './ConversationDocumentsPanel'
import { FileIcon } from './FileIcon'
import { cn } from './lib/cn'
import { PAGINATION_LABELS } from './pagination.constant'
import { formatDateTime, formatFileSize } from './lib/format'
import { formatPhone } from './lib/phone'
import type { CompanyDocument } from './providers/types'

export interface DocumentsLibraryLabels {
  title: string
  searchPlaceholder: string
  empty: string
  noResults: string
  loading: string
  failure: string
  view: string
  download: string
  openConversation: string
  sourceFilterAll: string
  sourceFilterCustomer: string
  sourceFilterTeam: string
  sortMostRecent: string
  sortOldest: string
  clearFilters: string
  total: (count: number) => string
  page: (current: number, last: number) => string
}

export const DEFAULT_DOCUMENTS_LIBRARY_LABELS: DocumentsLibraryLabels = {
  title: 'Documentos',
  searchPlaceholder: 'Buscar por nome do arquivo ou telefone',
  empty: 'Nenhum arquivo trocado ainda.',
  noResults: 'Nenhum arquivo encontrado para os filtros aplicados',
  loading: 'Carregando arquivos…',
  failure: 'Não foi possível carregar os arquivos.',
  view: 'Visualizar',
  download: 'Baixar',
  openConversation: 'Abrir conversa',
  sourceFilterAll: 'Todas as origens',
  sourceFilterCustomer: 'Cliente',
  sourceFilterTeam: 'Equipe',
  sortMostRecent: 'Mais recentes',
  sortOldest: 'Mais antigos',
  clearFilters: 'Limpar filtros',
  total: (count: number) => `${count} arquivo${count === 1 ? '' : 's'}`,
  page: (current: number, last: number) => `${current} / ${last}`,
}

export interface DocumentsLibraryClassNames {
  root: string
  title: string
  filters: string
  search: string
  sourceSelect: string
  sortButton: string
  clearButton: string
  status: string
  list: string
  item: string
  conversationLink: string
  filename: string
  meta: string
  pagination: string
}

export interface DocumentsLibraryProps {
  /** Itens por página. O total vem do servidor. */
  perPage?: number
  /** Abrir a conversa de origem. Ausente, o número aparece como texto e não como link. */
  onOpenConversation?: (conversationId: string) => void
  labels?: Partial<DocumentsLibraryLabels>
  className?: string
  classNames?: Partial<DocumentsLibraryClassNames>
}

const TEAM_SOURCES = new Set(['agent', 'bot'])
const DEFAULT_PER_PAGE = 20

export function DocumentsLibrary({
  perPage = DEFAULT_PER_PAGE,
  onOpenConversation,
  labels: labelsOverride,
  className,
  classNames,
}: DocumentsLibraryProps) {
  const labels = { ...DEFAULT_DOCUMENTS_LIBRARY_LABELS, ...labelsOverride }
  const context = useConversations()
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<DocumentSourceFilter>(DOCUMENT_SOURCE_FILTER.ALL)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [documents, setDocuments] = useState<readonly CompanyDocument[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const hasFilters = search !== '' || sourceFilter !== DOCUMENT_SOURCE_FILTER.ALL || sortDirection !== 'desc'
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  const fetchAll = context?.api.getAllDocuments

  useEffect(() => {
    if (!fetchAll) return
    let active = true
    setLoading(true)
    setFailed(false)

    void fetchAll({
      search,
      page,
      limit: perPage,
      sortDirection,
      ...(sourceFilter === DOCUMENT_SOURCE_FILTER.ALL ? {} : { source: sourceFilter }),
    })
      .then((result) => {
        // `active` evita que uma resposta antiga sobrescreva a nova: digitar rápido na busca dispara
        // várias chamadas e a ordem de retorno não é garantida.
        if (!active) return
        setDocuments(result.documents)
        setTotal(result.total)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [fetchAll, search, sourceFilter, sortDirection, page, perPage])

  function applyFilter(change: () => void): void {
    change()
    setPage(1)
  }

  async function handleOpen(uploadId: string, disposition: 'inline' | 'attachment'): Promise<void> {
    const url = await context?.api.getDocumentUrl(uploadId, disposition)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Host sem `getAllDocuments` não tem o que mostrar aqui — some, em vez de renderizar vazio para
  // sempre e fazer parecer que a empresa não tem arquivo nenhum.
  if (!fetchAll) return null

  return (
    <div className={cn('space-y-3', classNames?.root, className)}>
      <h2 className={cn('text-lg font-semibold', classNames?.title)}>{labels.title}</h2>

      <div className={cn('flex flex-wrap items-center gap-2', classNames?.filters)}>
        <input
          type="search"
          value={search}
          onChange={(event) => applyFilter(() => setSearch(event.target.value))}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.searchPlaceholder}
          className={cn('w-full rounded-md border px-3 py-2 text-sm sm:w-64', classNames?.search)}
        />

        <select
          value={sourceFilter}
          onChange={(event) => applyFilter(() => setSourceFilter(event.target.value as DocumentSourceFilter))}
          aria-label={labels.sourceFilterAll}
          className={cn('w-full rounded-md border px-2 py-2 text-sm sm:w-40', classNames?.sourceSelect)}
        >
          <option value={DOCUMENT_SOURCE_FILTER.ALL}>{labels.sourceFilterAll}</option>
          <option value={DOCUMENT_SOURCE_FILTER.CUSTOMER}>{labels.sourceFilterCustomer}</option>
          <option value={DOCUMENT_SOURCE_FILTER.TEAM}>{labels.sourceFilterTeam}</option>
        </select>

        <button
          data-cv-tooltip={sortDirection === 'desc' ? labels.sortMostRecent : labels.sortOldest} aria-label={sortDirection === 'desc' ? labels.sortMostRecent : labels.sortOldest}
          type="button"
          onClick={() => applyFilter(() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc'))}
          className={cn('cv-header-action inline-flex items-center gap-1', classNames?.sortButton)}
        >
          <ArrowUpDown size={14} />
          {sortDirection === 'desc' ? labels.sortMostRecent : labels.sortOldest}
        </button>

        {hasFilters ? (
          <button
            data-cv-tooltip={labels.clearFilters} aria-label={labels.clearFilters}
            type="button"
            onClick={() =>
              applyFilter(() => {
                setSearch('')
                setSourceFilter(DOCUMENT_SOURCE_FILTER.ALL)
                setSortDirection('desc')
              })
            }
            className={cn('cv-header-action', classNames?.clearButton)}
          >
            {labels.clearFilters}
          </button>
        ) : null}
      </div>

      {loading ? <p className={cn('text-sm text-gray-500', classNames?.status)}>{labels.loading}</p> : null}
      {failed ? (
        <p role="alert" className={cn('text-sm text-red-600 dark:text-red-400', classNames?.status)}>
          {labels.failure}
        </p>
      ) : null}
      {!loading && !failed && documents.length === 0 ? (
        <p className={cn('text-sm text-gray-500', classNames?.status)}>
          {hasFilters ? labels.noResults : labels.empty}
        </p>
      ) : null}

      <ul className={cn('space-y-2', classNames?.list)}>
        {documents.map((document) => {
          const isFromCustomer = !TEAM_SOURCES.has(document.source)
          const SourceIcon = isFromCustomer ? Users : Bot

          return (
            <li
              key={`${document.conversationId}:${document.id}`}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 dark:border-gray-700',
                classNames?.item,
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <FileIcon filename={document.filename} mimeType={document.mimeType} />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-sm font-medium', classNames?.filename)} data-cv-tooltip={document.filename}>
                    {document.filename}
                  </div>
                  <div className={cn('flex flex-wrap items-center gap-x-2 text-xs text-gray-500', classNames?.meta)}>
                    <span className="inline-flex items-center gap-1">
                      <SourceIcon size={11} />
                      {isFromCustomer ? labels.sourceFilterCustomer : labels.sourceFilterTeam}
                    </span>
                    <span>·</span>
                    <span>{formatDateTime(document.linkedAt)}</span>
                    <span>·</span>
                    <span>{formatFileSize(document.sizeBytes)}</span>
                  </div>
                </div>
              </div>

              {/* A conversa de origem é o dado que só esta tela tem. Vira botão quando o host sabe
                  navegar; sem handler, fica texto — link que não leva a lugar nenhum é pior. */}
              {onOpenConversation ? (
                <button
                  type="button"
                  onClick={() => onOpenConversation(document.conversationId)}
                  data-cv-tooltip={labels.openConversation} aria-label={labels.openConversation}
                  className={cn('cv-header-action inline-flex shrink-0 items-center gap-1', classNames?.conversationLink)}
                >
                  <MessageSquare size={12} />
                  {formatPhone(document.conversationId)}
                </button>
              ) : (
                <span className={cn('shrink-0 text-xs text-gray-500', classNames?.conversationLink)}>
                  {formatPhone(document.conversationId)}
                </span>
              )}

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => void handleOpen(document.id, 'inline')}
                  data-cv-tooltip={labels.view}
                  aria-label={`${labels.view}: ${document.filename}`}
                  className="cv-header-icon"
                >
                  <Eye size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleOpen(document.id, 'attachment')}
                  data-cv-tooltip={labels.download}
                  aria-label={`${labels.download}: ${document.filename}`}
                  className="cv-header-icon"
                >
                  <Download size={14} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {total > perPage ? (
        <div className={cn('flex items-center justify-between border-t pt-2 text-xs dark:border-gray-700', classNames?.pagination)}>
          <span className="text-gray-400">{labels.total(total)}</span>
          <div className="flex items-center gap-2">
            <button
              data-cv-tooltip={PAGINATION_LABELS.previous} aria-label={PAGINATION_LABELS.previous}
              type="button"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="cv-header-icon disabled:opacity-40"
            >
              ‹
            </button>
            <span className="text-gray-500">{labels.page(page, lastPage)}</span>
            <button
              data-cv-tooltip={PAGINATION_LABELS.next} aria-label={PAGINATION_LABELS.next}
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={page >= lastPage}
              className="cv-header-icon disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
