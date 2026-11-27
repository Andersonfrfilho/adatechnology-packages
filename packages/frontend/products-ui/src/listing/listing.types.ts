import type { ReactNode } from 'react'

import type { Product, ProductSortField, SortDirection } from '../providers/types'
import type { ProductsListingLabels } from './listing.labels'

export const PRODUCT_AVAILABILITY_FILTER = { ACTIVE: 'active', INACTIVE: 'inactive' } as const
export const PRODUCT_PRICING_FILTER = { ON_REQUEST: 'onRequest', PRICED: 'priced' } as const

export const PRODUCTS_PER_PAGE_OPTIONS = [10, 20, 50, 100] as const
export const PRODUCTS_DEFAULT_PER_PAGE = 20

/** Tudo o que a lista mostra e que a URL precisa lembrar: busca, filtros, ordem e página. */
export type ProductsListQuery = {
  readonly search: string
  readonly catalogIds: readonly string[]
  readonly sectionIds: readonly string[]
  readonly availability: readonly string[]
  readonly pricing: readonly string[]
  readonly sortBy?: ProductSortField
  readonly sortDirection: SortDirection
  readonly page: number
  readonly perPage: number
}

export type ProductsSelectOption = { readonly id: string; readonly label: string }

/** Seleção única — o host injeta o `Select` do design system dele (nunca `<select>` nativo). */
export type ProductsSelectRenderProps = {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly options: readonly ProductsSelectOption[]
  readonly onChange: (value: string) => void
}

/** Seleção múltipla dos filtros. Sem valor marcado = sem filtro. */
export type ProductsMultiSelectRenderProps = {
  readonly id: string
  readonly label: string
  readonly values: readonly string[]
  readonly options: readonly ProductsSelectOption[]
  readonly onChange: (values: string[]) => void
}

/** Campo de busca livre da barra de filtros. O host injeta o campo do design system dele, com rótulo visível como os demais filtros. */
export type ProductsSearchRenderProps = {
  readonly id: string
  readonly label: string
  readonly placeholder: string
  readonly value: string
  readonly onChange: (value: string) => void
}

/** O que o menu de exportação do host precisa: o filtro aplicado, a página visível e a seleção. */
export type ProductsExportContext = {
  readonly query: ProductsListQuery
  readonly total: number
  readonly pageProducts: readonly Product[]
  readonly selectedProducts: readonly Product[]
}

export type ProductsListingOptions = {
  readonly labels?: Partial<ProductsListingLabels>
  /** Estado controlado pelo host (query string). Sem `onQueryChange` a lista guarda o próprio. */
  readonly query?: ProductsListQuery
  readonly onQueryChange?: (query: ProductsListQuery) => void
  readonly renderSelect?: (props: ProductsSelectRenderProps) => ReactNode
  readonly renderMultiSelect?: (props: ProductsMultiSelectRenderProps) => ReactNode
  readonly renderSearch?: (props: ProductsSearchRenderProps) => ReactNode
  /** Encaixe do menu de exportação, ao lado de "Novo produto". Ausente, nada é desenhado. */
  readonly renderExport?: (context: ProductsExportContext) => ReactNode
  readonly perPageOptions?: readonly number[]
}
