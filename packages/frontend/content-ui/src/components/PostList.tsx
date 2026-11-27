/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Lista do painel: busca à esquerda, filtros, abas por situação, tabela ordenável com seleção em lote
 * e paginação do servidor. Estado (busca, aba, tags, página, tamanho, ordem) pode ir para a URL.
 */

import type { Post, PostSummary } from '@adatechnology/content-contracts'
import { CopyPlus, FilePlus2, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { POST_LIST_TAB, usePostList } from '../hooks/usePostList'
import type { ListUrlState } from '../lib/listUrlState'
import { useContentAdminApi, useContentText } from '../providers/ContentProvider'
import type { RenderDateTimeInput, RenderSelect } from '../providers/types'
import { BatchBar } from './BatchBar'
import { FromTemplateDialog, RepublishDialog, SaveAsTemplateDialog } from './PostActionDialogs'
import { PostListFooter } from './PostListFooter'
import { PostListTabs } from './PostListTabs'
import { PostListToolbar } from './PostListToolbar'
import { PostTable } from './PostTable'
import { RecurrencePanel } from './RecurrencePanel'
import { Tooltip } from './Tooltip'

type RowAction = 'saveAsTemplate' | 'fromTemplate' | 'republish'

/**
 * O que a lista está mostrando agora, para o host montar um botão "Exportar" ao lado dos filtros.
 *
 * O pacote não exporta nada: quem gera o arquivo é o backend do host, com os mesmos filtros da tela.
 * `filters` traz os filtros ativos já como texto; `pageCount`, quantas linhas a página tem.
 */
export type ListExportContext = {
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly pageCount: number
  readonly filters: Readonly<Record<string, string>>
}

function buildExportFilters(state: ListUrlState, tab: string | undefined): Readonly<Record<string, string>> {
  return {
    ...(tab ? { tab } : {}),
    ...(state.search ? { search: state.search } : {}),
    ...(state.tags.length > 0 ? { tag: state.tags.join(',') } : {}),
    sort: state.sort,
    order: state.order,
  }
}

export type PostListProps = {
  readonly onSelect: (post: PostSummary) => void
  /** Ausente: sem botão "Novo post". */
  readonly onCreate?: () => void
  readonly pageSize?: number
  /** Mude o valor para forçar recarga (ex.: depois de salvar no editor). */
  readonly reloadKey?: number
  /** Guarda busca, aba, tags, página, tamanho e ordem na query string. */
  readonly syncUrl?: boolean
  readonly renderDateTimeInput?: RenderDateTimeInput
  readonly renderSelect?: RenderSelect
  /** Ausente: sem exportação. Opt-in do host, na barra do título. */
  readonly renderExport?: (context: ListExportContext) => ReactNode
}

export function PostList({
  onSelect,
  onCreate,
  pageSize = 20,
  reloadKey,
  syncUrl,
  renderDateTimeInput,
  renderSelect,
  renderExport,
}: PostListProps) {
  const { messages } = useContentText()
  const api = useContentAdminApi()
  const [dialog, setDialog] = useState<{ readonly action: RowAction; readonly post: PostSummary } | undefined>()
  const list = usePostList({
    pageSize,
    ...(reloadKey !== undefined ? { reloadKey } : {}),
    ...(syncUrl ? { syncUrl } : {}),
  })
  const { posts, state, tab } = list
  const rows = posts.data?.data ?? []

  function actionsFor(post: PostSummary) {
    if (post.isTemplate) {
      return api.createFromTemplate
        ? [
            {
              action: 'fromTemplate' as const,
              icon: FilePlus2,
              label: messages.newFromTemplate,
              tip: messages.newFromTemplateTip,
            },
          ]
        : []
    }
    return [
      ...(post.status === 'published' && api.republishPost
        ? [{ action: 'republish' as const, icon: RefreshCw, label: messages.republish, tip: messages.republishTip }]
        : []),
      ...(api.saveAsTemplate
        ? [
            {
              action: 'saveAsTemplate' as const,
              icon: CopyPlus,
              label: messages.saveAsTemplate,
              tip: messages.saveAsTemplateTip,
            },
          ]
        : []),
    ]
  }

  function handleActionDone(post: Post): void {
    const action = dialog?.action
    setDialog(undefined)
    list.refresh()
    if (action === 'fromTemplate') onSelect(post)
    if (action === 'saveAsTemplate') list.setTab(POST_LIST_TAB.TEMPLATES)
  }

  function toggleAll(): void {
    list.setSelectedIds(list.selectedIds.size === rows.length ? new Set() : new Set(rows.map((row) => row.id)))
  }

  return (
    <section className="adc-root adc-post-list">
      <header className="adc-toolbar">
        <h2 className="adc-title">{messages.listTitle}</h2>
        {renderExport && posts.data
          ? renderExport({
              total: posts.data.pagination.total,
              page: state.page,
              pageSize: list.pageSize,
              pageCount: posts.data.data.length,
              filters: buildExportFilters(list.state, tab),
            })
          : null}
      </header>

      <PostListToolbar
        search={state.search}
        onSearch={list.setSearch}
        tags={list.tags}
        selectedTags={state.tags}
        onToggleTag={list.toggleTag}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        onCreate={onCreate}
      />

      {tab && <PostListTabs active={tab} counts={list.counts} onChange={list.setTab} />}

      {list.selectedIds.size > 0 && (
        <BatchBar
          ids={[...list.selectedIds]}
          tab={tab}
          onClearSelection={() => list.setSelectedIds(new Set())}
          onDone={list.refresh}
        />
      )}

      {posts.error !== undefined && !posts.isLoading ? (
        <div className="adc-state adc-state--error" role="alert">
          {messages.loadError}
          <button type="button" className="adc-button" onClick={posts.reload}>
            {messages.retry}
          </button>
        </div>
      ) : posts.isLoading && !posts.data ? (
        <p className="adc-state" role="status">
          {messages.loading}
        </p>
      ) : rows.length === 0 ? (
        <p className="adc-state">{tab === POST_LIST_TAB.TEMPLATES ? messages.emptyTemplates : messages.empty}</p>
      ) : (
        <PostTable
          rows={rows}
          sort={state.sort}
          order={state.order}
          onSort={list.toggleSort}
          selectedIds={list.selectedIds}
          onToggleSelected={list.toggleSelected}
          onToggleAll={toggleAll}
          onSelect={onSelect}
          hasActions={Boolean(tab)}
          isBusy={posts.isLoading}
          renderActions={(post) =>
            actionsFor(post).map(({ action, icon: Icon, label, tip }) => (
              <Tooltip key={action} text={tip}>
                <button
                  type="button"
                  className="adc-button adc-button--compact"
                  onClick={() => setDialog({ action, post })}
                >
                  <Icon aria-hidden="true" className="adc-icon" />
                  {label}
                </button>
              </Tooltip>
            ))
          }
        />
      )}

      {posts.data && (
        <PostListFooter
          data={posts.data}
          pageSize={list.pageSize}
          onPage={list.setPage}
          onPageSize={list.setPageSize}
          renderSelect={renderSelect}
        />
      )}

      {tab === POST_LIST_TAB.TEMPLATES && (
        <RecurrencePanel templates={rows} renderDateTimeInput={renderDateTimeInput} renderSelect={renderSelect} />
      )}

      {dialog?.action === 'saveAsTemplate' && (
        <SaveAsTemplateDialog post={dialog.post} onClose={() => setDialog(undefined)} onDone={handleActionDone} />
      )}
      {dialog?.action === 'fromTemplate' && (
        <FromTemplateDialog post={dialog.post} onClose={() => setDialog(undefined)} onDone={handleActionDone} />
      )}
      {dialog?.action === 'republish' && (
        <RepublishDialog
          post={dialog.post}
          renderDateTimeInput={renderDateTimeInput}
          onClose={() => setDialog(undefined)}
          onDone={handleActionDone}
        />
      )}
    </section>
  )
}
