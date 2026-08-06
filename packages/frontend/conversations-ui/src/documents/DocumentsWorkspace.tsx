/**
 * Tela completa de Documentos: a biblioteca de arquivos de TODAS as conversas, fora do atendimento.
 *
 * Distinta do `ConversationDocumentsPanel`, que parte de uma conversa aberta e vive dentro dela.
 * Esta varre a empresa, e por isso mostra de qual conversa cada arquivo veio.
 *
 * É a tela inteira, não um punhado de peças: ordenação por coluna, filtros de seleção múltipla,
 * recorte por data, seleção em lote, paginação e espelho na URL já vêm montados. Produto que
 * remontasse isso à mão voltaria a divergir dos outros — foi o que aconteceu antes desta tela existir.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Download, Eye, MessageSquare, Trash2, X } from 'lucide-react'

import { useConversations } from '../providers/ConversationsProvider'
import { FileIcon } from '../FileIcon'
import { cn } from '../lib/cn'
import { formatDateTime, formatFileSize } from '../lib/format'
import { formatPhone } from '../lib/phone'
import {
  BulkActionBar,
  ListingPagination,
  MultiSelectFilter,
  SortableHead,
  type FilterOption,
  type SortDirection,
} from '../listing'
import { useDebouncedValue, useUrlArrayState, useUrlNumberState, useUrlStringState } from '../hooks/useUrlFilterState'
import type { CompanyDocument } from '../providers/types'
import { DEFAULT_DOCUMENTS_WORKSPACE_LABELS, type DocumentsWorkspaceLabels } from './labels'

const DEFAULT_PER_PAGE = 20
const DEFAULT_PER_PAGE_OPTIONS = [10, 20, 50, 100] as const
const DEFAULT_SORT_FIELD = 'linkedAt'

export interface DocumentsWorkspaceClassNames {
  root: string
  header: string
  filters: string
  table: string
  row: string
  status: string
}

export interface DocumentsWorkspaceProps {
  readonly perPage?: number
  readonly perPageOptions?: readonly number[]
  /** Abrir a conversa de origem. Ausente, o número aparece como texto e não como link. */
  readonly onOpenConversation?: (conversationId: string) => void
  /** Origens filtráveis. Ausente, usa o vocabulário padrão (`customer`, `agent`, `bot`). */
  readonly sources?: readonly FilterOption[]
  /** Categorias de arquivo. Lista vazia esconde o filtro — nem todo host classifica anexo. */
  readonly categories?: readonly FilterOption[]
  /** Recorte por data. Desligado quando o backend não sabe filtrar por período. */
  readonly dateFilter?: boolean
  /**
   * Filtros do produto (cliente, unidade, campanha). Recebe os parâmetros extras atuais e devolve
   * os controles; o que o produto guardar aqui viaja em `extra` para o `getAllDocuments`.
   */
  readonly renderFilters?: (context: DocumentsFiltersContext) => ReactNode
  readonly labels?: Partial<DocumentsWorkspaceLabels>
  readonly className?: string
  readonly classNames?: Partial<DocumentsWorkspaceClassNames>
  /** Espelhar filtros e paginação na URL. Desligado em preview, onde não há rota de verdade. */
  readonly syncUrl?: boolean
}

export interface DocumentsFiltersContext {
  readonly extra: Readonly<Record<string, string | number>>
  readonly setExtra: (next: Readonly<Record<string, string | number>>) => void
}

export function DocumentsWorkspace({
  perPage: initialPerPage = DEFAULT_PER_PAGE,
  perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
  onOpenConversation,
  sources,
  categories,
  dateFilter = true,
  renderFilters,
  labels: labelsOverride,
  className,
  classNames,
  syncUrl = true,
}: DocumentsWorkspaceProps) {
  const labels = { ...DEFAULT_DOCUMENTS_WORKSPACE_LABELS, ...labelsOverride }
  const context = useConversations()
  const urlOptions = { enabled: syncUrl }

  const [search, setSearch] = useUrlStringState('search', '', urlOptions)
  const [source, setSource] = useUrlArrayState('source', urlOptions)
  const [category, setCategory] = useUrlArrayState('fileCategory', urlOptions)
  const [startDate, setStartDate] = useUrlStringState('startDate', '', urlOptions)
  const [endDate, setEndDate] = useUrlStringState('endDate', '', urlOptions)
  const [sortField, setSortField] = useUrlStringState('sortField', DEFAULT_SORT_FIELD, urlOptions)
  const [sortDirection, setSortDirection] = useUrlStringState('sortDirection', 'desc', urlOptions)
  const [page, setPage] = useUrlNumberState('page', 1, urlOptions)
  const [perPage, setPerPage] = useUrlNumberState('limit', initialPerPage, urlOptions)
  const [extra, setExtra] = useState<Readonly<Record<string, string | number>>>({})

  const [documents, setDocuments] = useState<readonly CompanyDocument[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [reloadToken, setReloadToken] = useState(0)
  const [busy, setBusy] = useState(false)

  const debouncedSearch = useDebouncedValue(search)
  const fetchAll = context?.api.getAllDocuments
  const removeDocument = context?.api.deleteDocument
  const downloadArchive = context?.api.downloadDocumentsArchiveByIds
  const extraKey = JSON.stringify(extra)

  const sourceOptions = useMemo<readonly FilterOption[]>(
    () => sources ?? Object.entries(labels.sourceLabels).map(([value, label]) => ({ value, label })),
    [sources, labels.sourceLabels],
  )
  const categoryOptions = useMemo<readonly FilterOption[]>(
    () => categories ?? Object.entries(labels.categoryLabels).map(([value, label]) => ({ value, label })),
    [categories, labels.categoryLabels],
  )

  const hasFilters =
    debouncedSearch !== '' ||
    source.length > 0 ||
    category.length > 0 ||
    startDate !== '' ||
    endDate !== '' ||
    Object.keys(extra).length > 0

  useEffect(() => {
    if (!fetchAll) return
    let active = true
    setLoading(true)
    setFailed(false)

    void fetchAll({
      search: debouncedSearch || undefined,
      page,
      limit: perPage,
      sortField,
      sortDirection: sortDirection === 'asc' ? 'asc' : 'desc',
      ...(source.length > 0 ? { source: source.join(',') } : {}),
      ...(category.length > 0 ? { fileCategory: category.join(',') } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(Object.keys(extra).length > 0 ? { extra } : {}),
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
    // `extraKey` no lugar de `extra`: o objeto é remontado a cada render do host e a identidade
    // sozinha dispararia a busca em loop.

  }, [fetchAll, debouncedSearch, source, category, startDate, endDate, sortField, sortDirection, page, perPage, extraKey, reloadToken])

  // Trocar de filtro mantendo a página 7 mostra "nenhum resultado" com dados existindo na página 1.
  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())

  }, [debouncedSearch, source, category, startDate, endDate, perPage, extraKey])

  function toggleSort(field: string): void {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  function toggleRow(id: string): void {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const isAllSelected = documents.length > 0 && documents.every((document) => selectedIds.has(document.id))

  function toggleAll(): void {
    setSelectedIds(isAllSelected ? new Set() : new Set(documents.map((document) => document.id)))
  }

  function clearFilters(): void {
    setSearch('')
    setSource([])
    setCategory([])
    setStartDate('')
    setEndDate('')
    setExtra({})
  }

  async function handleOpen(uploadId: string, disposition: 'inline' | 'attachment'): Promise<void> {
    const url = await context?.api.getDocumentUrl(uploadId, disposition)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleRemove(ids: readonly string[]): Promise<void> {
    if (!removeDocument) return
    setBusy(true)
    try {
      await Promise.all(ids.map((id) => removeDocument(id)))
      setSelectedIds(new Set())
      setReloadToken((token) => token + 1)
    } finally {
      setBusy(false)
    }
  }

  async function handleDownloadArchive(): Promise<void> {
    if (!downloadArchive) return
    setBusy(true)
    try {
      const blob = await downloadArchive(Array.from(selectedIds))
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'documentos.zip'
      anchor.click()
      URL.revokeObjectURL(url)
      setSelectedIds(new Set())
    } finally {
      setBusy(false)
    }
  }

  // Host sem `getAllDocuments` não tem o que mostrar aqui — some, em vez de renderizar vazio para
  // sempre e fazer parecer que a empresa não tem arquivo nenhum.
  if (!fetchAll) return null

  const direction: SortDirection = sortDirection === 'asc' ? 'asc' : 'desc'
  const canSelect = Boolean(removeDocument ?? downloadArchive)

  return (
    <div className={cn('space-y-4', classNames?.root, className)}>
      <header className={cn('space-y-0.5', classNames?.header)}>
        <h2 className="text-lg font-semibold">{labels.title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{labels.subtitle(total)}</p>
      </header>

      <div className={cn('flex flex-wrap items-center gap-2', classNames?.filters)}>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.searchPlaceholder}
          className="w-full rounded-md border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 sm:w-64"
        />

        <MultiSelectFilter label={labels.sourceFilter} options={sourceOptions} selected={source} onChange={setSource} />

        {categoryOptions.length > 0 ? (
          <MultiSelectFilter
            label={labels.categoryFilter}
            options={categoryOptions}
            selected={category}
            onChange={setCategory}
          />
        ) : null}

        {dateFilter ? (
          <>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              aria-label={labels.startDate}
              className="rounded-md border px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-900"
            />
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              aria-label={labels.endDate}
              className="rounded-md border px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-900"
            />
          </>
        ) : null}

        {renderFilters?.({ extra, setExtra })}

        {hasFilters ? (
          <button type="button" onClick={clearFilters} className="cv-header-action inline-flex items-center gap-1">
            <X size={12} aria-hidden="true" />
            {labels.clearFilters}
          </button>
        ) : null}
      </div>

      {canSelect ? (
        <BulkActionBar
          selectedCount={selectedIds.size}
          selectedLabel={labels.bulkSelected}
          clearLabel={labels.bulkClear}
          onClear={() => setSelectedIds(new Set())}
        >
          {downloadArchive ? (
            <button
              type="button"
              onClick={() => void handleDownloadArchive()}
              disabled={busy}
              className="cv-header-action inline-flex items-center gap-1 disabled:opacity-40"
            >
              <Download size={12} aria-hidden="true" />
              {labels.bulkDownloadZip}
            </button>
          ) : null}
          {removeDocument ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(labels.bulkRemoveConfirm(selectedIds.size))) void handleRemove(Array.from(selectedIds))
              }}
              disabled={busy}
              className="cv-header-action cv-header-action--danger inline-flex items-center gap-1 disabled:opacity-40"
            >
              <Trash2 size={12} aria-hidden="true" />
              {labels.bulkRemove(selectedIds.size)}
            </button>
          ) : null}
        </BulkActionBar>
      ) : null}

      {loading ? <p className={cn('text-sm text-gray-500', classNames?.status)}>{labels.loading}</p> : null}
      {failed ? (
        <p role="alert" className={cn('text-sm text-red-600 dark:text-red-400', classNames?.status)}>
          {labels.failure}
        </p>
      ) : null}

      <div className={cn('overflow-x-auto rounded-xl border dark:border-gray-700', classNames?.table)}>
        <table className="w-full text-sm">
          <thead className="border-b text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <tr>
              {canSelect ? (
                <th scope="col" className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleAll}
                    aria-label={labels.selectAllPage}
                    className="cursor-pointer rounded border-gray-300 text-blue-600 dark:border-gray-600"
                  />
                </th>
              ) : null}
              <SortableHead label={labels.columnFilename} field="filename" activeField={sortField} direction={direction} onSort={toggleSort} />
              <SortableHead label={labels.columnContact} field="conversationId" activeField={sortField} direction={direction} onSort={toggleSort} className="hidden sm:table-cell" />
              <SortableHead label={labels.columnType} field="mimeType" activeField={sortField} direction={direction} onSort={toggleSort} className="hidden md:table-cell" />
              <SortableHead label={labels.columnSize} field="sizeBytes" activeField={sortField} direction={direction} onSort={toggleSort} className="hidden lg:table-cell" />
              <SortableHead label={labels.columnSource} field="source" activeField={sortField} direction={direction} onSort={toggleSort} className="hidden lg:table-cell" />
              <SortableHead label={labels.columnDate} field="linkedAt" activeField={sortField} direction={direction} onSort={toggleSort} className="hidden xl:table-cell" />
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium">
                {labels.columnActions}
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={`${document.conversationId}:${document.id}`} className={cn('border-b last:border-0 dark:border-gray-800', classNames?.row)}>
                {canSelect ? (
                  <td className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(document.id)}
                      onChange={() => toggleRow(document.id)}
                      aria-label={`${labels.selectRow}: ${document.filename}`}
                      className="cursor-pointer rounded border-gray-300 text-blue-600 dark:border-gray-600"
                    />
                  </td>
                ) : null}

                <td className="max-w-xs px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileIcon filename={document.filename} mimeType={document.mimeType} />
                    <span className="truncate font-medium" title={document.filename}>
                      {document.filename}
                    </span>
                  </div>
                </td>

                {/* A conversa de origem é o dado que só esta tela tem. Vira botão quando o host sabe
                    navegar; sem handler, fica texto — link que não leva a lugar nenhum é pior. */}
                <td className="hidden px-3 py-2 sm:table-cell">
                  {onOpenConversation ? (
                    <button
                      type="button"
                      onClick={() => onOpenConversation(document.conversationId)}
                      title={labels.openConversation}
                      className="cv-header-action inline-flex items-center gap-1"
                    >
                      <MessageSquare size={12} aria-hidden="true" />
                      {document.contactName ?? formatPhone(document.conversationId)}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500">{document.contactName ?? formatPhone(document.conversationId)}</span>
                  )}
                </td>

                <td className="hidden px-3 py-2 font-mono text-xs md:table-cell">{document.mimeType}</td>
                <td className="hidden px-3 py-2 text-xs lg:table-cell">{formatFileSize(document.sizeBytes)}</td>
                <td className="hidden px-3 py-2 text-xs lg:table-cell">
                  {labels.sourceLabels[document.source] ?? document.source}
                </td>
                <td className="hidden px-3 py-2 text-xs xl:table-cell">{formatDateTime(document.linkedAt)}</td>

                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => void handleOpen(document.id, 'inline')}
                      title={labels.view}
                      aria-label={`${labels.view}: ${document.filename}`}
                      className="cv-header-icon"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpen(document.id, 'attachment')}
                      title={labels.download}
                      aria-label={`${labels.download}: ${document.filename}`}
                      className="cv-header-icon"
                    >
                      <Download size={14} />
                    </button>
                    {removeDocument ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(labels.removeConfirm(document.filename))) void handleRemove([document.id])
                        }}
                        disabled={busy}
                        title={labels.remove}
                        aria-label={`${labels.remove}: ${document.filename}`}
                        className="cv-header-icon disabled:opacity-40"
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && documents.length === 0 ? (
          <p className={cn('py-8 text-center text-sm text-gray-400', classNames?.status)}>
            {hasFilters ? labels.noResults : labels.empty}
          </p>
        ) : null}
      </div>

      <ListingPagination
        page={page}
        total={total}
        perPage={perPage}
        perPageOptions={perPageOptions}
        onPageChange={setPage}
        onPerPageChange={setPerPage}
        labels={{
          show: labels.show,
          perPage: labels.perPage,
          total: labels.total,
          page: labels.page,
          previous: labels.previousPage,
          next: labels.nextPage,
        }}
      />
    </div>
  )
}
