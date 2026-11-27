/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Ingredient, IngredientSortField, Paginated, RecipeUnit } from '@adatechnology/recipe-contracts'
import { useCallback, useState } from 'react'

import { useRecipesApi } from '../providers/RecipesProvider'
import type { IngredientFiltersParams, SortOrder } from '../providers/types'
import { useAsyncResource, type AsyncResource } from './useAsyncResource'

export type IngredientListState = {
  readonly page: number
  readonly pageSize: number
  readonly search: string
  readonly units: readonly RecipeUnit[]
  readonly sort: IngredientSortField
  readonly order: SortOrder
}

export type IngredientList = AsyncResource<Paginated<Ingredient>> & {
  readonly state: IngredientListState
  readonly filters: IngredientFiltersParams
  readonly setPage: (page: number) => void
  readonly setPageSize: (pageSize: number) => void
  readonly setSearch: (search: string) => void
  readonly toggleUnit: (unit: RecipeUnit) => void
  readonly clearFilters: () => void
  readonly toggleSort: (field: IngredientSortField) => void
}

const INITIAL_STATE: IngredientListState = { page: 1, pageSize: 20, search: '', units: [], sort: 'name', order: 'asc' }

/** Lista paginada no servidor: busca, filtro de unidade e ordenação voltam para a página 1. */
export function useIngredientList(initial: Partial<IngredientListState> = {}): IngredientList {
  const api = useRecipesApi()
  const [state, setState] = useState<IngredientListState>({ ...INITIAL_STATE, ...initial })
  const filters: IngredientFiltersParams = {
    ...(state.search ? { search: state.search } : {}),
    ...(state.units.length ? { units: state.units } : {}),
    sort: state.sort,
    order: state.order,
  }
  const resource = useAsyncResource(
    () => api.listIngredients({ page: state.page, pageSize: state.pageSize, ...filters }),
    JSON.stringify(state),
  )

  const setSearch = useCallback((search: string) => setState((current) => ({ ...current, search, page: 1 })), [])
  return {
    ...resource,
    state,
    filters,
    setPage: (page) => setState((current) => ({ ...current, page })),
    setPageSize: (pageSize) => setState((current) => ({ ...current, pageSize, page: 1 })),
    setSearch,
    toggleUnit: (unit) =>
      setState((current) => ({
        ...current,
        page: 1,
        units: current.units.includes(unit) ? current.units.filter((item) => item !== unit) : [...current.units, unit],
      })),
    clearFilters: () => setState((current) => ({ ...current, search: '', units: [], page: 1 })),
    toggleSort: (field) =>
      setState((current) => ({
        ...current,
        page: 1,
        sort: field,
        order: current.sort === field && current.order === 'asc' ? 'desc' : 'asc',
      })),
  }
}
