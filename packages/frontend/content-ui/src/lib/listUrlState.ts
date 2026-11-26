/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estado da lista na URL (`?q=&tab=&tags=&page=&size=&sort=&order=`): recarregar a página, voltar do
 * editor e mandar o link a um colega reabrem a lista exatamente como estava.
 */

import { POST_SORT_FIELDS, type PostSortField } from '@adatechnology/content-contracts'

import type { PostListTab } from '../hooks/usePostList'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

export type ListUrlState = {
  readonly tab?: PostListTab
  readonly search: string
  readonly tags: readonly string[]
  readonly page: number
  readonly pageSize?: number
  readonly sort: PostSortField
  readonly order: 'asc' | 'desc'
}

export const DEFAULT_LIST_STATE: ListUrlState = {
  search: '',
  tags: [],
  page: 1,
  sort: 'updatedAt',
  order: 'desc',
}

const TABS: readonly string[] = ['published', 'scheduled', 'draft', 'templates']

function positiveInteger(value: string | null): number | undefined {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

/** Lê a URL tolerando lixo: valor inválido cai no padrão, nunca quebra a tela. */
export function parseListUrlState(search: string): ListUrlState {
  const params = new URLSearchParams(search)
  const sort = params.get('sort')
  const size = positiveInteger(params.get('size'))
  const tab = params.get('tab')
  return {
    ...DEFAULT_LIST_STATE,
    ...(tab && TABS.includes(tab) ? { tab: tab as PostListTab } : {}),
    search: params.get('q') ?? '',
    tags: (params.get('tags') ?? '').split(',').filter(Boolean),
    page: positiveInteger(params.get('page')) ?? 1,
    ...(size && (PAGE_SIZE_OPTIONS as readonly number[]).includes(size) ? { pageSize: size } : {}),
    sort: (POST_SORT_FIELDS as readonly string[]).includes(sort ?? '') ? (sort as PostSortField) : 'updatedAt',
    order: params.get('order') === 'asc' ? 'asc' : 'desc',
  }
}

/** Só grava o que difere do padrão: a URL de uma lista intocada fica limpa. */
export function serializeListUrlState(state: ListUrlState): string {
  const params = new URLSearchParams()
  if (state.tab && state.tab !== 'published') params.set('tab', state.tab)
  if (state.search) params.set('q', state.search)
  if (state.tags.length > 0) params.set('tags', state.tags.join(','))
  if (state.page > 1) params.set('page', String(state.page))
  if (state.pageSize) params.set('size', String(state.pageSize))
  if (state.sort !== DEFAULT_LIST_STATE.sort) params.set('sort', state.sort)
  if (state.order !== DEFAULT_LIST_STATE.order) params.set('order', state.order)
  return params.toString()
}
