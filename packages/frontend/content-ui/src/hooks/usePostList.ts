/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PostStatus, TagCount } from '@adatechnology/content-contracts'
import { useState } from 'react'

import { useContentAdminApi } from '../providers/ContentProvider'
import { useAsyncResource } from './useAsyncResource'

export type PostListFilters = {
  readonly status?: PostStatus
  readonly tag?: string
  readonly search?: string
}

export function usePostList(params: { readonly pageSize: number; readonly reloadKey?: number }) {
  const api = useContentAdminApi()
  const [filters, setFilters] = useState<PostListFilters>({})
  const [page, setPage] = useState(1)

  const key = JSON.stringify({ filters, page, pageSize: params.pageSize, reload: params.reloadKey ?? 0 })
  const posts = useAsyncResource(() => api.listPosts({ ...filters, page, pageSize: params.pageSize }), key)
  const tags = useAsyncResource<readonly TagCount[]>(
    () => (api.listTags ? api.listTags() : Promise.resolve([])),
    `tags-${params.reloadKey ?? 0}`,
  )

  function updateFilters(next: PostListFilters): void {
    // Filtro novo volta à primeira página: ficar na página 4 de um resultado com 1 página mostra vazio.
    setFilters(next)
    setPage(1)
  }

  return {
    posts,
    tags: api.listTags ? (tags.data ?? []) : undefined,
    filters,
    updateFilters,
    page,
    setPage,
    hasFilters: Boolean(filters.status || filters.tag || filters.search),
  }
}
