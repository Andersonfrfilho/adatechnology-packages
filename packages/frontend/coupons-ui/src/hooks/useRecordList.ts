/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Paginated } from '@adatechnology/coupon-contracts'
import { useCallback, useState } from 'react'

import type { ListRecordsParams, SortOrder } from '../providers/types'
import { useAsyncResource, type AsyncResource } from './useAsyncResource'

export type RecordListState = {
  readonly search: string
  readonly page: number
  readonly pageSize: number
  readonly order: SortOrder
}

export type RecordListController<TRecord> = {
  readonly records: AsyncResource<Paginated<TRecord>>
  readonly state: RecordListState
  readonly setSearch: (search: string) => void
  readonly setPage: (page: number) => void
  readonly setPageSize: (pageSize: number) => void
  readonly toggleOrder: () => void
  readonly clear: () => void
  readonly hasFilters: boolean
}

const INITIAL: RecordListState = { search: '', page: 1, pageSize: 20, order: 'desc' }

/** Lista paginada no servidor de códigos, contatos ou usos de uma campanha (camada headless). */
export function useRecordList<TRecord>(params: {
  readonly key: string
  readonly load: (query: ListRecordsParams) => Promise<Paginated<TRecord>>
  readonly extraKey?: string
}): RecordListController<TRecord> {
  const [state, setState] = useState<RecordListState>(INITIAL)
  const records = useAsyncResource(
    () =>
      params.load({
        page: state.page,
        pageSize: state.pageSize,
        order: state.order,
        ...(state.search ? { search: state.search } : {}),
      }),
    JSON.stringify({ key: params.key, extra: params.extraKey ?? '', state }),
  )
  const change = useCallback(
    (patch: Partial<RecordListState>) => setState((current) => ({ ...current, page: 1, ...patch })),
    [],
  )
  return {
    records,
    state,
    setSearch: useCallback((search: string) => change({ search }), [change]),
    setPage: (page) => setState((current) => ({ ...current, page })),
    setPageSize: (pageSize) => change({ pageSize }),
    toggleOrder: () => change({ order: state.order === 'desc' ? 'asc' : 'desc' }),
    clear: () => change({ search: '', order: 'desc' }),
    hasFilters: Boolean(state.search) || state.order !== 'desc',
  }
}
