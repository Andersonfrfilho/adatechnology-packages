import { Plus, Upload } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { PRODUCT_OPTIONAL_FIELD, type Product, type Section } from '../providers/types'
import { useIsProductFieldEnabled, useProductsConfig } from '../providers/ProductsProvider'
import { DEFAULT_PRICE_ON_REQUEST_LABEL } from '../lib/productFields'
import type { ProductsWorkspaceState } from '../workspace/useProductsWorkspace'
import { DefaultMultiSelect, DefaultSelect } from './DefaultMenu'
import { DEFAULT_PRODUCTS_LISTING_LABELS } from './listing.labels'
import { nextSort } from './listQuery'
import { PRODUCTS_PER_PAGE_OPTIONS, type ProductsListingOptions } from './listing.types'
import { ProductsBatchBar } from './ProductsBatchBar'
import { ProductsFilterBar } from './ProductsFilterBar'
import { ProductsPagination } from './ProductsPagination'
import { ProductsTable } from './ProductsTable'
import { useProductsBatch } from './useProductsBatch'

export type ProductsListingProps = {
  readonly options: ProductsListingOptions
  readonly workspace: ProductsWorkspaceState
  readonly sections: readonly Section[]
  readonly onImport: () => void
  readonly onCreate: () => void
  readonly importLabel: string
  readonly createLabel: string
}

const ACTION_CLASS = 'inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium'

/** Lista de produtos em tabela: busca, filtros múltiplos, ordem, lote e paginação no servidor. */
export function ProductsListing({ options, workspace, sections, onImport, onCreate, importLabel, createLabel }: ProductsListingProps) {
  const labels = { ...DEFAULT_PRODUCTS_LISTING_LABELS, ...options.labels }
  const config = useProductsConfig()
  const isFieldEnabled = useIsProductFieldEnabled()
  const renderSelect = options.renderSelect ?? DefaultSelect
  const renderMultiSelect = options.renderMultiSelect ?? DefaultMultiSelect
  const { listQuery, setListQuery, products, total, loading, reload } = workspace
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])
  const batch = useProductsBatch(reload)

  function handleToggle(id: string): void {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  function handleTogglePage(): void {
    const isAllSelected = products.every((product) => selectedIds.has(product.id))
    setSelectedIds(isAllSelected ? new Set() : new Set(products.map((product) => product.id)))
  }

  const selectedProducts = useMemo<readonly Product[]>(
    () => products.filter((product) => selectedIds.has(product.id)),
    [products, selectedIds],
  )

  const actions = (
    <>
      {options.renderExport?.({ query: listQuery, total, pageProducts: products, selectedProducts })}
      <button type="button" onClick={onImport} className={`${ACTION_CLASS} border border-gray-300 text-gray-700 hover:bg-gray-50`}>
        <Upload aria-hidden="true" className="h-4 w-4" />
        {importLabel}
      </button>
      <button type="button" onClick={onCreate} className={`${ACTION_CLASS} bg-brand-600 text-white hover:bg-brand-700`}>
        <Plus aria-hidden="true" className="h-4 w-4" />
        {createLabel}
      </button>
    </>
  )

  return (
    <div className="space-y-3">
      <ProductsFilterBar
        labels={labels}
        query={listQuery}
        total={total}
        catalogs={workspace.catalogs}
        sections={sections}
        showSection={isFieldEnabled(PRODUCT_OPTIONAL_FIELD.SECTION)}
        renderMultiSelect={renderMultiSelect}
        onChange={(patch) => { clearSelection(); setListQuery(patch) }}
        onReplace={(query) => { clearSelection(); setListQuery(query) }}
        actions={actions}
      />

      <ProductsBatchBar
        labels={labels}
        selectedIds={[...selectedIds]}
        catalogs={workspace.catalogs}
        batch={batch}
        renderSelect={renderSelect}
        onClearSelection={clearSelection}
      />

      <div aria-busy={loading} className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        {products.length === 0 && !loading ? (
          <p className="py-12 text-center text-sm text-gray-500">{total === 0 && listQuery.search === '' ? labels.empty : labels.emptyFiltered}</p>
        ) : (
          <ProductsTable
            labels={labels}
            products={products}
            query={listQuery}
            selectedIds={selectedIds}
            moneyFormat={{ currency: config.currency, locale: config.locale }}
            priceOnRequestLabel={config.priceOnRequestLabel ?? DEFAULT_PRICE_ON_REQUEST_LABEL}
            showSection={isFieldEnabled(PRODUCT_OPTIONAL_FIELD.SECTION)}
            showSortOrder={isFieldEnabled(PRODUCT_OPTIONAL_FIELD.SORT_ORDER)}
            onSort={(field) => setListQuery(nextSort(listQuery, field))}
            onToggle={handleToggle}
            onTogglePage={handleTogglePage}
            onOpen={workspace.openDraft}
          />
        )}
      </div>

      <ProductsPagination
        labels={labels}
        query={listQuery}
        total={total}
        perPageOptions={options.perPageOptions ?? PRODUCTS_PER_PAGE_OPTIONS}
        renderSelect={renderSelect}
        onChange={setListQuery}
      />
    </div>
  )
}
