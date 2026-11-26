/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { POST_STATUSES, type Post, type PostStatus, type PostSummary } from '@adatechnology/content-contracts'
import { CopyPlus, FilePlus2, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useId, useState } from 'react'

import { POST_LIST_TAB, usePostList } from '../hooks/usePostList'
import { formatPostDate } from '../lib/format'
import type { ContentMessages } from '../locales'
import { useContentAdminApi, useContentText } from '../providers/ContentProvider'
import type { RenderDateTimeInput, RenderSelect } from '../providers/types'
import { Pagination } from './Pagination'
import { FromTemplateDialog, RepublishDialog, SaveAsTemplateDialog } from './PostActionDialogs'
import { PostListTabs } from './PostListTabs'
import { RecurrencePanel } from './RecurrencePanel'
import { StatusChip } from './StatusChip'
import { Tooltip } from './Tooltip'

type RowAction = 'saveAsTemplate' | 'fromTemplate' | 'republish'

const STATUS_LABEL: Record<PostStatus, keyof ContentMessages> = {
  draft: 'statusDraft',
  scheduled: 'statusScheduled',
  published: 'statusPublished',
  archived: 'statusArchived',
}

export type PostListProps = {
  readonly onSelect: (post: PostSummary) => void
  /** Ausente: sem botão "Novo post". */
  readonly onCreate?: () => void
  readonly pageSize?: number
  /** Mude o valor para forçar recarga (ex.: depois de salvar no editor). */
  readonly reloadKey?: number
  readonly renderDateTimeInput?: RenderDateTimeInput
  readonly renderSelect?: RenderSelect
}

export function PostList({
  onSelect,
  onCreate,
  pageSize = 20,
  reloadKey,
  renderDateTimeInput,
  renderSelect,
}: PostListProps) {
  const { messages, locale } = useContentText()
  const api = useContentAdminApi()
  const [dialog, setDialog] = useState<{ readonly action: RowAction; readonly post: PostSummary } | undefined>()
  const { posts, counts, tab, setTab, refresh, tags, filters, updateFilters, page, setPage, hasFilters } = usePostList({
    pageSize,
    ...(reloadKey !== undefined ? { reloadKey } : {}),
  })
  function actionsFor(post: PostSummary) {
    const saveAsTemplate = {
      action: 'saveAsTemplate' as const,
      icon: CopyPlus,
      label: messages.saveAsTemplate,
      tip: messages.saveAsTemplateTip,
    }
    if (post.isTemplate && api.createFromTemplate) {
      return [
        {
          action: 'fromTemplate' as const,
          icon: FilePlus2,
          label: messages.newFromTemplate,
          tip: messages.newFromTemplateTip,
        },
      ]
    }
    const republish = {
      action: 'republish' as const,
      icon: RefreshCw,
      label: messages.republish,
      tip: messages.republishTip,
    }
    return [
      ...(post.status === 'published' && api.republishPost ? [republish] : []),
      ...(api.saveAsTemplate && !post.isTemplate ? [saveAsTemplate] : []),
    ]
  }

  function handleActionDone(post: Post): void {
    const created = dialog?.action !== 'republish'
    setDialog(undefined)
    refresh()
    if (created && dialog?.action === 'fromTemplate') onSelect(post)
    if (dialog?.action === 'saveAsTemplate') setTab(POST_LIST_TAB.TEMPLATES)
  }

  const searchId = useId()
  const statusId = useId()
  const tagId = useId()

  return (
    <section className="adc-root adc-post-list">
      <header className="adc-toolbar">
        <h2 className="adc-title">{messages.listTitle}</h2>
        {onCreate && (
          <button type="button" className="adc-button adc-button--primary" onClick={onCreate}>
            <Plus aria-hidden="true" className="adc-icon" />
            {messages.newPost}
          </button>
        )}
      </header>

      {tab && <PostListTabs active={tab} counts={counts} onChange={setTab} />}

      <div className="adc-filters">
        <div className="adc-field adc-field--search">
          <label htmlFor={searchId}>{messages.searchLabel}</label>
          <div className="adc-input-icon">
            <Search aria-hidden="true" className="adc-icon" />
            <input
              id={searchId}
              type="search"
              placeholder={messages.searchPlaceholder}
              value={filters.search ?? ''}
              onChange={(event) => updateFilters({ ...filters, search: event.target.value || undefined })}
            />
          </div>
        </div>
        {!tab && (
          <div className="adc-field">
            <label htmlFor={statusId}>{messages.filterStatus}</label>
            <select
              id={statusId}
              value={filters.status ?? ''}
              onChange={(event) =>
                updateFilters({ ...filters, status: (event.target.value || undefined) as PostStatus | undefined })
              }
            >
              <option value="">{messages.filterAll}</option>
              {POST_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {messages[STATUS_LABEL[status]]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="adc-field">
          <label htmlFor={tagId}>{messages.filterTag}</label>
          <input
            id={tagId}
            list={tags && tags.length > 0 ? `${tagId}-list` : undefined}
            value={filters.tag ?? ''}
            onChange={(event) => updateFilters({ ...filters, tag: event.target.value || undefined })}
          />
          {tags && (
            <datalist id={`${tagId}-list`}>
              {tags.map((entry) => (
                <option key={entry.tag} value={entry.tag} />
              ))}
            </datalist>
          )}
        </div>
        {hasFilters && (
          <button type="button" className="adc-button adc-button--ghost" onClick={() => updateFilters({})}>
            <RotateCcw aria-hidden="true" className="adc-icon" />
            {messages.clearFilters}
          </button>
        )}
      </div>

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
      ) : (posts.data?.data.length ?? 0) === 0 ? (
        <p className="adc-state">{tab === POST_LIST_TAB.TEMPLATES ? messages.emptyTemplates : messages.empty}</p>
      ) : (
        <div className="adc-table-wrap" aria-busy={posts.isLoading}>
          <table className="adc-table">
            <thead>
              <tr>
                <th scope="col">{messages.columnTitle}</th>
                <th scope="col">{messages.columnStatus}</th>
                <th scope="col">{messages.columnPublished}</th>
                <th scope="col">{messages.columnUpdated}</th>
                {tab && <th scope="col">{messages.columnActions}</th>}
              </tr>
            </thead>
            <tbody>
              {posts.data?.data.map((post) => (
                <tr key={post.id}>
                  <td>
                    <button type="button" className="adc-row-link" onClick={() => onSelect(post)}>
                      {post.title}
                    </button>
                    <span className="adc-muted adc-slug">/{post.slug}</span>
                  </td>
                  <td>
                    <StatusChip status={post.status} isTemplate={post.isTemplate} />
                  </td>
                  <td>{formatPostDate(post.publishedAt, locale, true)}</td>
                  <td>{formatPostDate(post.updatedAt, locale, true)}</td>
                  {tab && (
                    <td className="adc-row-actions">
                      {actionsFor(post).map(({ action, icon: Icon, label, tip }) => (
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
                      ))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === POST_LIST_TAB.TEMPLATES && (
        <RecurrencePanel
          templates={posts.data?.data ?? []}
          renderDateTimeInput={renderDateTimeInput}
          renderSelect={renderSelect}
        />
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

      {posts.data && <Pagination page={page} totalPages={posts.data.pagination.totalPages} onPageChange={setPage} />}
    </section>
  )
}
