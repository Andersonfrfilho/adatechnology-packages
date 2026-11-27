import { Search, X } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import type { Catalog, Section } from '../providers/types'
import { PRODUCT_FILTER_NONE } from '../providers/types'
import { DefaultMultiSelect } from './DefaultMenu'
import { hasActiveListFilters, clearListFilters } from './listQuery'
import type { ProductsListingLabels } from './listing.labels'
import {
  PRODUCT_AVAILABILITY_FILTER,
  PRODUCT_PRICING_FILTER,
  type ProductsListQuery,
  type ProductsListingOptions,
  type ProductsSelectOption,
} from './listing.types'

export type ProductsFilterBarProps = {
  readonly labels: ProductsListingLabels
  readonly query: ProductsListQuery
  readonly total: number
  readonly catalogs: readonly Catalog[]
  readonly sections: readonly Section[]
  readonly showSection: boolean
  readonly renderMultiSelect: NonNullable<ProductsListingOptions['renderMultiSelect']>
  readonly renderSearch?: ProductsListingOptions['renderSearch']
  readonly onChange: (patch: Partial<ProductsListQuery>) => void
  readonly onReplace: (query: ProductsListQuery) => void
  readonly actions: ReactNode
}

const BUTTON_CLASS =
  'inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'

export function ProductsFilterBar(props: ProductsFilterBarProps) {
  const { labels, query, total, catalogs, sections, showSection, renderMultiSelect, renderSearch, onChange, onReplace, actions } =
    props
  const baseId = useId()

  const catalogOptions: ProductsSelectOption[] = [
    ...catalogs.map((catalog) => ({ id: catalog.id, label: catalog.name })),
    { id: PRODUCT_FILTER_NONE, label: labels.noCatalog },
  ]
  const sectionOptions: ProductsSelectOption[] = [
    ...sections.map((section) => ({ id: section.id, label: section.name })),
    { id: PRODUCT_FILTER_NONE, label: labels.noSection },
  ]
  const availabilityOptions: ProductsSelectOption[] = [
    { id: PRODUCT_AVAILABILITY_FILTER.ACTIVE, label: labels.availabilityActive },
    { id: PRODUCT_AVAILABILITY_FILTER.INACTIVE, label: labels.availabilityInactive },
  ]
  const pricingOptions: ProductsSelectOption[] = [
    { id: PRODUCT_PRICING_FILTER.ON_REQUEST, label: labels.pricingOnRequest },
    { id: PRODUCT_PRICING_FILTER.PRICED, label: labels.pricingPriced },
  ]

  return (
    <div role="search" className="flex flex-wrap items-end gap-2">
      {renderSearch ? (
        renderSearch({
          id: `${baseId}-search`,
          label: labels.searchLabel,
          placeholder: labels.search,
          value: query.search,
          onChange: (search) => onChange({ search }),
        })
      ) : (
        <div className="relative min-w-48 max-w-md flex-[2_1_16rem]">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder={labels.search}
            aria-label={labels.search}
            autoComplete="off"
            className="min-h-11 w-full rounded-lg border border-gray-300 py-2 !pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}
      {renderMultiSelect({
        id: `${baseId}-catalog`,
        label: labels.catalog,
        values: query.catalogIds,
        options: catalogOptions,
        onChange: (catalogIds) => onChange({ catalogIds }),
      })}
      {showSection
        ? renderMultiSelect({
            id: `${baseId}-section`,
            label: labels.section,
            values: query.sectionIds,
            options: sectionOptions,
            onChange: (sectionIds) => onChange({ sectionIds }),
          })
        : null}
      {renderMultiSelect({
        id: `${baseId}-availability`,
        label: labels.availability,
        values: query.availability,
        options: availabilityOptions,
        onChange: (availability) => onChange({ availability }),
      })}
      {renderMultiSelect({
        id: `${baseId}-pricing`,
        label: labels.pricing,
        values: query.pricing,
        options: pricingOptions,
        onChange: (pricing) => onChange({ pricing }),
      })}

      {hasActiveListFilters(query) ? (
        <button type="button" onClick={() => onReplace(clearListFilters(query))} className={BUTTON_CLASS}>
          <X aria-hidden="true" className="h-4 w-4" />
          {labels.clearFilters}
        </button>
      ) : null}

      <span role="status" className="pb-3 text-sm text-gray-600 whitespace-nowrap">
        {labels.results(total)}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}
