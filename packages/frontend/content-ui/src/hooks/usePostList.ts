/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PostCounts, PostStatus, TagCount } from '@adatechnology/content-contracts'
import { useState } from 'react'

import { useContentAdminApi } from '../providers/ContentProvider'
import { useAsyncResource } from './useAsyncResource'

export type PostListFilters = {
  readonly status?: PostStatus
  readonly tag?: string
  readonly search?: string
}

/** Aba da lista: só existe quando a API injetada sabe contar (`countPosts`). */
export const POST_LIST_TAB = {
  PUBLISHED: 'published',
  SCHEDULED: 'scheduled',
  DRAFT: 'draft',
  TEMPLATES: 'templates',
} as const
export type PostListTab = (typeof POST_LIST_TAB)[keyof typeof POST_LIST_TAB]

export function usePostList(params: { readonly pageSize: number; readonly reloadKey?: number }) {
  const api = useContentAdminApi()
  const hasTabs = Boolean(api.countPosts)
  const [filters, setFilters] = useState<PostListFilters>({})
  const [tab, setTabState] = useState<PostListTab>(POST_LIST_TAB.PUBLISHED)
  const [page, setPage] = useState(1)
  const [localReload, setLocalReload] = useState(0)
  const reload = (params.reloadKey ?? 0) + localReload

  const tabFilter = !hasTabs ? {} : tab === POST_LIST_TAB.TEMPLATES ? { isTemplate: true } : { status: tab }
  const key = JSON.stringify({ filters, tab: hasTabs ? tab : undefined, page, pageSize: params.pageSize, reload })
  const posts = useAsyncResource(
    () => api.listPosts({ ...filters, ...tabFilter, page, pageSize: params.pageSize }),
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

  function updateFilters(next: PostListFilters): void {
    // Filtro novo volta à primeira página: ficar na página 4 de um resultado com 1 página mostra vazio.
    setFilters(next)
    setPage(1)
  }

  function setTab(next: PostListTab): void {
    setTabState(next)
    setPage(1)
  }

  return {
    posts,
    counts: counts.data,
    tags: api.listTags ? (tags.data ?? []) : undefined,
    filters,
    updateFilters,
    tab: hasTabs ? tab : undefined,
    setTab,
    refresh: () => setLocalReload((value) => value + 1),
    page,
    setPage,
    hasFilters: Boolean(filters.status || filters.tag || filters.search),
  }
}
