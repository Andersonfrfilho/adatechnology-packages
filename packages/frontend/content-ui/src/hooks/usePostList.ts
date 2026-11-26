/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PostCounts, PostSortField, TagCount } from '@adatechnology/content-contracts'
import { useEffect, useState } from 'react'

import { DEFAULT_LIST_STATE, parseListUrlState, serializeListUrlState, type ListUrlState } from '../lib/listUrlState'
import { useContentAdminApi } from '../providers/ContentProvider'
import { useAsyncResource } from './useAsyncResource'

/** Aba da lista: só existe quando a API injetada sabe contar (`countPosts`). */
export const POST_LIST_TAB = {
  PUBLISHED: 'published',
  SCHEDULED: 'scheduled',
  DRAFT: 'draft',
  TEMPLATES: 'templates',
} as const
export type PostListTab = (typeof POST_LIST_TAB)[keyof typeof POST_LIST_TAB]

export type PostListFilters = {
  readonly tags: readonly string[]
  readonly search: string
}

function initialState(syncUrl: boolean): ListUrlState {
  if (!syncUrl || typeof window === 'undefined') return DEFAULT_LIST_STATE
  return parseListUrlState(window.location.search)
}

export function usePostList(params: {
  readonly pageSize: number
  readonly reloadKey?: number
  /** Espelha busca, aba, tags, página, tamanho e ordem na query string da URL. */
  readonly syncUrl?: boolean
}) {
  const api = useContentAdminApi()
  const syncUrl = params.syncUrl ?? false
  const hasTabs = Boolean(api.countPosts)
  const [state, setState] = useState<ListUrlState>(() => initialState(syncUrl))
  const [localReload, setLocalReload] = useState(0)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const reload = (params.reloadKey ?? 0) + localReload
  const tab: PostListTab | undefined = hasTabs ? (state.tab ?? POST_LIST_TAB.PUBLISHED) : undefined
  const pageSize = state.pageSize ?? params.pageSize

  useEffect(() => {
    if (!syncUrl || typeof window === 'undefined') return
    const query = serializeListUrlState({ ...state, ...(tab ? { tab } : {}) })
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState(window.history.state, '', url)
  }, [state, tab, syncUrl])

  const tabFilter = !tab ? {} : tab === POST_LIST_TAB.TEMPLATES ? { isTemplate: true } : { status: tab }
  const key = JSON.stringify({ state, tab, pageSize, reload })
  const posts = useAsyncResource(
    () =>
      api.listPosts({
        ...tabFilter,
        ...(state.search ? { search: state.search } : {}),
        ...(state.tags.length > 0 ? { tag: state.tags.join(',') } : {}),
        sort: state.sort,
        order: state.order,
        page: state.page,
        pageSize,
      }),
    key,
  )
  const counts = useAsyncResource<PostCounts | undefined>(
    () => (api.countPosts ? api.countPosts() : Promise.resolve(undefined)),
    `counts-${reload}`,
  )
  const tags = useAsyncResource<readonly TagCount[]>(
    () => (api.listTags ? api.listTags() : Promise.resolve([])),
    `tags-${reload}`,
  )

  // Mudou a lista (filtro, página, ordem, recarga): a seleção antiga apontaria para linhas que sumiram.
  useEffect(() => setSelectedIds(new Set()), [key])

  // Filtro novo volta à primeira página: ficar na 4 de um resultado com 1 página mostra vazio.
  const change = (patch: Partial<ListUrlState>): void => setState((current) => ({ ...current, page: 1, ...patch }))

  function toggleSort(field: PostSortField): void {
    change({ sort: field, order: state.sort === field && state.order === 'asc' ? 'desc' : 'asc' })
  }

  function toggleTag(tag: string): void {
    change({ tags: state.tags.includes(tag) ? state.tags.filter((entry) => entry !== tag) : [...state.tags, tag] })
  }

  function toggleSelected(id: string): void {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  return {
    posts,
    counts: counts.data,
    tags: api.listTags ? (tags.data ?? []) : undefined,
    state,
    tab,
    pageSize,
    selectedIds,
    setSelectedIds,
    toggleSelected,
    toggleSort,
    toggleTag,
    setTab: (next: PostListTab) => change({ tab: next }),
    setSearch: (search: string) => change({ search }),
    setPageSize: (next: number) => change({ pageSize: next }),
    setPage: (page: number) => setState((current) => ({ ...current, page })),
    clearFilters: () => change({ search: '', tags: [] }),
    refresh: () => setLocalReload((value) => value + 1),
    hasFilters: Boolean(state.search || state.tags.length > 0),
  }
}
