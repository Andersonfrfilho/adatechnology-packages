/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estado da lista de campanhas (camada headless): busca, situação, ordem, página e seleção, com a
 * URL espelhando tudo quando `syncUrl` está ligado.
 */

import type { CampaignListItem, CampaignState, Paginated } from '@adatechnology/coupon-contracts'
import { useCallback, useEffect, useState } from 'react'

import {
  DEFAULT_CAMPAIGN_LIST_STATE,
  parseCampaignListState,
  serializeCampaignListState,
  type CampaignListState,
  type CampaignSortKey,
} from '../lib/listUrlState'
import { useCouponsAdminApi } from '../providers/CouponsProvider'
import { useAsyncResource, type AsyncResource } from './useAsyncResource'

function initialState(syncUrl: boolean): CampaignListState {
  if (!syncUrl || typeof window === 'undefined') return DEFAULT_CAMPAIGN_LIST_STATE
  return parseCampaignListState(window.location.search)
}

export type CampaignListController = {
  readonly campaigns: AsyncResource<Paginated<CampaignListItem>>
  readonly state: CampaignListState
  readonly selectedIds: ReadonlySet<string>
  readonly hasFilters: boolean
  readonly setSearch: (search: string) => void
  readonly setStates: (states: CampaignState[]) => void
  readonly toggleSort: (sort: CampaignSortKey) => void
  readonly setPage: (page: number) => void
  readonly setPageSize: (pageSize: number) => void
  readonly clearFilters: () => void
  readonly toggleSelected: (id: string) => void
  readonly setSelectedIds: (ids: ReadonlySet<string>) => void
}

export function useCampaignList(
  params: { readonly syncUrl?: boolean; readonly reloadKey?: number } = {},
): CampaignListController {
  const api = useCouponsAdminApi()
  const syncUrl = params.syncUrl ?? false
  const [state, setState] = useState<CampaignListState>(() => initialState(syncUrl))
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const key = JSON.stringify({ state, reload: params.reloadKey ?? 0 })

  useEffect(() => {
    if (!syncUrl || typeof window === 'undefined') return
    const query = serializeCampaignListState(state, window.location.search)
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    )
  }, [state, syncUrl])

  const campaigns = useAsyncResource(
    () =>
      api.listCampaigns({
        page: state.page,
        pageSize: state.pageSize,
        sort: state.sort,
        order: state.order,
        ...(state.search ? { search: state.search } : {}),
        ...(state.states.length ? { states: state.states } : {}),
      }),
    key,
  )

  // Lista mudou: a seleção antiga apontaria para linhas que sumiram.
  useEffect(() => setSelectedIds(new Set()), [key])

  // Filtro novo volta à primeira página.
  const change = useCallback(
    (patch: Partial<CampaignListState>) => setState((current) => ({ ...current, page: 1, ...patch })),
    [],
  )

  return {
    campaigns,
    state,
    selectedIds,
    hasFilters: Boolean(
      state.search ||
      state.states.length ||
      state.sort !== DEFAULT_CAMPAIGN_LIST_STATE.sort ||
      state.order !== DEFAULT_CAMPAIGN_LIST_STATE.order,
    ),
    setSearch: useCallback((search: string) => change({ search }), [change]),
    setStates: (states) => change({ states }),
    // Mesma coluna alterna asc → desc → padrão (neutro).
    toggleSort: (sort) => {
      if (state.sort !== sort) return change({ sort, order: 'asc' })
      if (state.order === 'asc') return change({ order: 'desc' })
      return change({ sort: DEFAULT_CAMPAIGN_LIST_STATE.sort, order: DEFAULT_CAMPAIGN_LIST_STATE.order })
    },
    setPage: (page) => setState((current) => ({ ...current, page })),
    setPageSize: (pageSize) => change({ pageSize }),
    clearFilters: () =>
      change({
        search: '',
        states: [],
        sort: DEFAULT_CAMPAIGN_LIST_STATE.sort,
        order: DEFAULT_CAMPAIGN_LIST_STATE.order,
      }),
    toggleSelected: (id) =>
      setSelectedIds((current) => {
        const next = new Set(current)
        if (!next.delete(id)) next.add(id)
        return next
      }),
    setSelectedIds,
  }
}
