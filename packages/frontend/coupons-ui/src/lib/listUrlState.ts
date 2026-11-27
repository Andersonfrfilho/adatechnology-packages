/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Busca, filtros, ordem e página da lista na query string: sobrevivem ao reload e ao link copiado.
 */

import { CAMPAIGN_STATES, type CampaignState } from '@adatechnology/coupon-contracts'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
export const CAMPAIGN_SORT_KEYS = ['createdAt', 'updatedAt', 'name', 'startsAt', 'endsAt'] as const
export type CampaignSortKey = (typeof CAMPAIGN_SORT_KEYS)[number]

export type CampaignListState = {
  readonly search: string
  readonly states: readonly CampaignState[]
  readonly sort: CampaignSortKey
  readonly order: 'asc' | 'desc'
  readonly page: number
  readonly pageSize: number
}

export const DEFAULT_CAMPAIGN_LIST_STATE: CampaignListState = {
  search: '',
  states: [],
  sort: 'createdAt',
  order: 'desc',
  page: 1,
  pageSize: 20,
}

const PREFIX = 'campaigns'

export function parseCampaignListState(search: string): CampaignListState {
  const params = new URLSearchParams(search)
  const get = (key: string) => params.get(`${PREFIX}.${key}`)
  const page = Number(get('page'))
  const pageSize = Number(get('pageSize'))
  const sort = get('sort')
  return {
    search: get('q') ?? '',
    states: (get('state') ?? '')
      .split(',')
      .filter((state): state is CampaignState => (CAMPAIGN_STATES as readonly string[]).includes(state)),
    sort: (CAMPAIGN_SORT_KEYS as readonly string[]).includes(sort ?? '')
      ? (sort as CampaignSortKey)
      : DEFAULT_CAMPAIGN_LIST_STATE.sort,
    order: get('order') === 'asc' ? 'asc' : 'desc',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_CAMPAIGN_LIST_STATE.pageSize,
  }
}

/** Mantém os parâmetros do host intactos; só os `campaigns.*` mudam, e o padrão não polui a URL. */
export function serializeCampaignListState(state: CampaignListState, currentSearch = ''): string {
  const params = new URLSearchParams(currentSearch)
  for (const key of [...params.keys()]) if (key.startsWith(`${PREFIX}.`)) params.delete(key)
  const set = (key: string, value: string, fallback: string) => {
    if (value !== fallback) params.set(`${PREFIX}.${key}`, value)
  }
  set('q', state.search, '')
  set('state', state.states.join(','), '')
  set('sort', state.sort, DEFAULT_CAMPAIGN_LIST_STATE.sort)
  set('order', state.order, DEFAULT_CAMPAIGN_LIST_STATE.order)
  set('page', String(state.page), '1')
  set('pageSize', String(state.pageSize), String(DEFAULT_CAMPAIGN_LIST_STATE.pageSize))
  return params.toString()
}
