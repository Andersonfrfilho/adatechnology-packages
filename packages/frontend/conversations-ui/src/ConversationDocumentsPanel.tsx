/**
 * Arquivos trocados na conversa. Sai do transcript e vira lista própria porque anexo é o que o
 * atendente mais precisa reencontrar depois — rolar meses de mensagens para achar um comprovante é
 * o caso que a busca por documento existe para eliminar.
 *
 * Usa `useConversationDocuments`, então funciona com qualquer `ConversationsApi`. Host sem
 * biblioteca de documentos cai no estado vazio, sem quebrar.
 */

import { useState } from 'react'
import { ArrowUpDown, Bot, Download, Eye, Users } from 'lucide-react'
import { useConversationDocuments } from './hooks/useConversationDocuments'
import { useConversations } from './providers/ConversationsProvider'
import { FileIcon } from './FileIcon'
import { cn } from './lib/cn'
import { formatDateTime, formatFileSize } from './lib/format'

/** Origens que o filtro oferece. `all` não é origem — é a ausência de filtro. */
export const DOCUMENT_SOURCE_FILTER = {
  ALL: 'all',
  CUSTOMER: 'customer',
  TEAM: 'team',
} as const
export type DocumentSourceFilter = (typeof DOCUMENT_SOURCE_FILTER)[keyof typeof DOCUMENT_SOURCE_FILTER]

/**
 * `bot` e `agent` caem em "Equipe": para quem procura um comprovante, o que importa é se veio do
 * cliente ou saiu da loja — não se foi o robô ou a pessoa que apertou enviar.
 */
const TEAM_SOURCES = new Set(['agent', 'bot'])

export interface ConversationDocumentsPanelLabels {
  toggle: string
  title: string
  searchPlaceholder: string
  empty: string
  /** Distinto de `empty`: sem resultado POR CAUSA do filtro, e não conversa sem anexo nenhum. */
  noResults: string
  loading: string
  failure: string
  download: string
  view: string
  sourceFilterAll: string
  sourceFilterCustomer: string
  sourceFilterTeam: string
  sortMostRecent: string
  sortOldest: string
  clearFilters: string
  selectAll: string
  downloadSelected: (count: number) => string
  archiveFailed: string
  total: (count: number) => string
  page: (current: number, last: number) => string
}

export const DEFAULT_CONVERSATION_DOCUMENTS_LABELS: ConversationDocumentsPanelLabels = {
  toggle: '📎 Arquivos',
  title: 'Arquivos da conversa',
  noResults: 'Nenhum arquivo encontrado para os filtros aplicados',
  view: 'Visualizar',
  sourceFilterAll: 'Todas as origens',
  sourceFilterCustomer: 'Cliente',
  sourceFilterTeam: 'Equipe',
  sortMostRecent: 'Mais recentes',
  sortOldest: 'Mais antigos',
  clearFilters: 'Limpar filtros',
  selectAll: 'Selecionar todos desta página',
  downloadSelected: (count: number) => `Baixar ${count} selecionado${count === 1 ? '' : 's'} (.zip)`,
  archiveFailed: 'Não foi possível montar o arquivo compactado.',
  total: (count: number) => `${count} arquivo${count === 1 ? '' : 's'}`,
  page: (current: number, last: number) => `${current} / ${last}`,
  searchPlaceholder: 'Buscar por nome do arquivo',
  empty: 'Nenhum arquivo nesta conversa.',
  loading: 'Carregando arquivos…',
  failure: 'Não foi possível carregar os arquivos.',
  download: 'Baixar',
}

/**
 * Partes estilizáveis do painel, no mesmo contrato do `ConversationHeader`: `cn` funde por cima da
 * base e conflito de utilitário (padding, tamanho de fonte, borda) fica com o valor do produto.
 *
 * `status` cobre carregando/erro/vazio de uma vez — são a mesma linha de texto auxiliar, e slots
 * separados só multiplicariam chave para quem quer mudar a cor de aviso.
 */
export interface ConversationDocumentsPanelClassNames {
  root: string
  body: string
  title: string
  filters: string
  search: string
  sourceSelect: string
  sortButton: string
  clearButton: string
  status: string
  list: string
  item: string
  sourceBadge: string
  filename: string
  meta: string
  viewButton: string
  downloadButton: string
  pagination: string
  selectionBar: string
  checkbox: string
}

export interface ConversationDocumentsPanelProps {
  conversationId: string
  /** Controlado de fora porque o gatilho vive no cabeçalho, junto das outras ações da conversa. */
  open: boolean
  /** Itens por página. O total vem do servidor; sem paginação no host, a barra não aparece. */
  perPage?: number
  labels?: Partial<ConversationDocumentsPanelLabels>
  className?: string
  classNames?: Partial<ConversationDocumentsPanelClassNames>
}

const DEFAULT_PER_PAGE = 10

export function ConversationDocumentsPanel({
  conversationId,
  open,
  perPage = DEFAULT_PER_PAGE,
  labels: labelsOverride,
  className,
  classNames,
}: ConversationDocumentsPanelProps) {
  const labels = { ...DEFAULT_CONVERSATION_DOCUMENTS_LABELS, ...labelsOverride }
  const context = useConversations()
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<DocumentSourceFilter>(DOCUMENT_SOURCE_FILTER.ALL)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
  const [archiveError, setArchiveError] = useState(false)

  const hasFilters = search !== '' || sourceFilter !== DOCUMENT_SOURCE_FILTER.ALL || sortDirection !== 'desc'

  // Só busca quando o painel abre: a lista de anexos é consulta extra e não deve pesar em toda
  // conversa aberta.
  const { documents, total, loading, error } = useConversationDocuments(open ? conversationId : undefined, {
    search,
    page,
    limit: perPage,
    sortDirection,
    ...(sourceFilter === DOCUMENT_SOURCE_FILTER.ALL ? {} : { source: sourceFilter }),
  })

  const lastPage = Math.max(1, Math.ceil(total / perPage))

  /**
   * Toda mudança de filtro volta para a página 1. Sem isso, filtrar na página 3 pede ao servidor
   * uma fatia que o novo resultado talvez não tenha, e o painel aparece vazio como se não houvesse
   * arquivo — o mesmo motivo do `setDocumentsPage(1)` em cada handler do financiamento.
   */
  function applyFilter(change: () => void): void {
    change()
    setPage(1)
  }

  async function handleOpen(uploadId: string, disposition: 'inline' | 'attachment'): Promise<void> {
    const url = await context?.api.getDocumentUrl(uploadId, disposition)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Ausente = host não sabe montar zip (só assina URL). Esconder é melhor que oferecer e falhar.
  const canArchive = typeof context?.api.downloadDocumentsArchive === 'function'
  const pageIds = documents.map((document) => document.id)
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))

  function toggleSelected(uploadId: string): void {
    setArchiveError(false)
    setSelectedIds((current) =>
      current.includes(uploadId) ? current.filter((id) => id !== uploadId) : [...current, uploadId],
    )
  }

  function toggleAllOnPage(): void {
    setArchiveError(false)
    // Só mexe nos itens DESTA página: quem selecionou algo na página 1, foi para a 2 e marcou
    // "todos" não deve perder a seleção anterior.
    setSelectedIds((current) =>
      allOnPageSelected
        ? current.filter((id) => !pageIds.includes(id))
        : [...current, ...pageIds.filter((id) => !current.includes(id))],
    )
  }

  async function handleDownloadSelected(): Promise<void> {
    const archive = context?.api.downloadDocumentsArchive
    if (!archive || selectedIds.length === 0) return

    setArchiveError(false)
    try {
      const blob = await archive(conversationId, selectedIds)
      // Âncora temporária com objectURL: é o que faz o navegador salvar um Blob com nome. O
      // revoke é obrigatório — sem ele o blob fica na memória da aba até recarregar.
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `conversa-${conversationId}.zip`
      anchor.click()
      URL.revokeObjectURL(url)
      setSelectedIds([])
    } catch {
      setArchiveError(true)
    }
  }

  if (!open) return null

  return (
    <div className={cn('border-b', classNames?.root, className)}>
      <section className={cn('px-4 py-3', classNames?.body)}>
        <p className={cn('mb-2 text-sm font-medium', classNames?.title)}>{labels.title}</p>

        {/* Barra de filtros com wrap: em tela estreita os quatro controles empilham em vez de
            estourar a largura do painel. */}
        <div className={cn('mb-2 flex flex-wrap items-center gap-2 border-b pb-2', classNames?.filters)}>
          <input
            type="search"
            value={search}
            onChange={(event) => applyFilter(() => setSearch(event.target.value))}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.searchPlaceholder}
            className={cn('w-full rounded-md border px-3 py-2 text-sm sm:w-52', classNames?.search)}
          />

          <select
            value={sourceFilter}
            onChange={(event) => applyFilter(() => setSourceFilter(event.target.value as DocumentSourceFilter))}
            aria-label={labels.sourceFilterAll}
            className={cn('w-full rounded-md border px-2 py-2 text-sm sm:w-36', classNames?.sourceSelect)}
          >
            <option value={DOCUMENT_SOURCE_FILTER.ALL}>{labels.sourceFilterAll}</option>
            <option value={DOCUMENT_SOURCE_FILTER.CUSTOMER}>{labels.sourceFilterCustomer}</option>
            <option value={DOCUMENT_SOURCE_FILTER.TEAM}>{labels.sourceFilterTeam}</option>
          </select>

          <button
            type="button"
            onClick={() => applyFilter(() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc'))}
            className={cn('cv-header-action inline-flex items-center gap-1', classNames?.sortButton)}
          >
            <ArrowUpDown size={14} />
            {sortDirection === 'desc' ? labels.sortMostRecent : labels.sortOldest}
          </button>

          {/* Só aparece com filtro ativo: botão que não faz nada visível é ruído. */}
          {hasFilters ? (
            <button
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

        {loading ? <p className={cn('text-xs text-gray-500', classNames?.status)}>{labels.loading}</p> : null}
        {error ? (
          <p role="alert" className={cn('text-xs text-red-600 dark:text-red-400', classNames?.status)}>
            {labels.failure}
          </p>
        ) : null}
        {!loading && !error && documents.length === 0 ? (
          <p className={cn('text-xs text-gray-500', classNames?.status)}>
            {/* Distinguir os dois evita o mal-entendido de "a conversa não tem anexo" quando o
                filtro é que não casou. */}
            {hasFilters ? labels.noResults : labels.empty}
          </p>
        ) : null}

        {canArchive && documents.length > 0 ? (
          <div className={cn('mb-2 flex flex-wrap items-center gap-3 text-xs', classNames?.selectionBar)}>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleAllOnPage}
                className={cn(classNames?.checkbox)}
              />
              {labels.selectAll}
            </label>
            {selectedIds.length > 0 ? (
              <button type="button" onClick={() => void handleDownloadSelected()} className="cv-header-action">
                {labels.downloadSelected(selectedIds.length)}
              </button>
            ) : null}
            {archiveError ? (
              <span role="alert" className="text-red-600 dark:text-red-400">
                {labels.archiveFailed}
              </span>
            ) : null}
          </div>
        ) : null}

        <ul className={cn('space-y-2', classNames?.list)}>
          {documents.map((document) => {
            const isFromCustomer = !TEAM_SOURCES.has(document.source)
            const SourceIcon = isFromCustomer ? Users : Bot

            return (
              <li
                key={document.id}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 dark:border-gray-700',
                  classNames?.item,
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {canArchive ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(document.id)}
                      onChange={() => toggleSelected(document.id)}
                      aria-label={`${labels.download}: ${document.filename}`}
                      className={cn('shrink-0', classNames?.checkbox)}
                    />
                  ) : null}
                  {/* `filename` junto do mimeType, e não só o mimeType: o mapa de ícones é indexado
                      por extensão curta, e o mimeType do Office é longo
                      (`…wordprocessingml.document`), então docx/doc/xlsx/xls caíam todos no ícone
                      genérico cinza. Com o nome, a extensão resolve primeiro. */}
                  <FileIcon filename={document.filename} mimeType={document.mimeType} />
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'mb-0.5 flex items-center gap-1 text-[11px] font-medium',
                        isFromCustomer
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-emerald-600 dark:text-emerald-400',
                        classNames?.sourceBadge,
                      )}
                    >
                      <SourceIcon size={11} />
                      {isFromCustomer ? labels.sourceFilterCustomer : labels.sourceFilterTeam}
                    </div>
                    {/* `title` no nome: truncado, o atendente não tem outro jeito de ler inteiro. */}
                    <div
                      className={cn('truncate text-sm font-medium', classNames?.filename)}
                      title={document.filename}
                    >
                      {document.filename}
                    </div>
                    <div className={cn('text-xs text-gray-500 dark:text-gray-400', classNames?.meta)}>
                      {formatDateTime(document.linkedAt)}
                      {' · '}
                      {formatFileSize(document.sizeBytes)}
                    </div>
                  </div>
                </div>

                {/* Ver e baixar são ações distintas, não a mesma com nome diferente: o
                    `disposition` viaja na assinatura da URL, e depois de assinada não há como o
                    cliente mudar entre abrir no navegador e salvar. */}
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => void handleOpen(document.id, 'inline')}
                    title={labels.view}
                    aria-label={`${labels.view}: ${document.filename}`}
                    className={cn('cv-header-icon', classNames?.viewButton)}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleOpen(document.id, 'attachment')}
                    title={labels.download}
                    aria-label={`${labels.download}: ${document.filename}`}
                    className={cn('cv-header-icon', classNames?.downloadButton)}
                  >
                    <Download size={14} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>

        {/* Só com mais de uma página: barra de paginação numa lista de três anexos é ruído. */}
        {total > perPage ? (
          <div
            className={cn(
              'mt-2 flex items-center justify-between border-t pt-2 text-xs dark:border-gray-700',
              classNames?.pagination,
            )}
          >
            <span className="text-gray-400">{labels.total(total)}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                aria-label={labels.sortOldest}
                className="cv-header-icon disabled:opacity-40"
              >
                ‹
              </button>
              <span className="text-gray-500">{labels.page(page, lastPage)}</span>
              <button
                type="button"
                onClick={() => setPage(page + 1)}
                disabled={page >= lastPage}
                aria-label={labels.sortMostRecent}
                className="cv-header-icon disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
