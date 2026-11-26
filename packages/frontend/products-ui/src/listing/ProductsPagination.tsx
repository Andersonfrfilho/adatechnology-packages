import type { ProductsListingLabels } from './listing.labels'
import type { ProductsListQuery, ProductsSelectRenderProps } from './listing.types'

export type ProductsPaginationProps = {
  readonly labels: ProductsListingLabels
  readonly query: ProductsListQuery
  readonly total: number
  readonly perPageOptions: readonly number[]
  readonly renderSelect: (props: ProductsSelectRenderProps) => React.ReactNode
  readonly onChange: (patch: Partial<ProductsListQuery>) => void
}

const STEP_CLASS = 'inline-flex min-h-11 items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40'

export function ProductsPagination({ labels, query, total, perPageOptions, renderSelect, onChange }: ProductsPaginationProps) {
  if (total === 0) return null
  const pageCount = Math.max(1, Math.ceil(total / query.perPage))
  const first = (query.page - 1) * query.perPage + 1
  const last = Math.min(query.page * query.perPage, total)

  return (
    <nav aria-label={labels.paginationLabel} className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
      <span role="status">{labels.range(first, last, total)}</span>
      <div className="flex items-center gap-2">
        <span>{labels.perPage}</span>
        {renderSelect({
          id: 'products-per-page',
          label: labels.perPage,
          value: String(query.perPage),
          options: perPageOptions.map((size) => ({ id: String(size), label: String(size) })),
          onChange: (value) => onChange({ perPage: Number(value), page: 1 }),
        })}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" disabled={query.page <= 1} onClick={() => onChange({ page: query.page - 1 })} className={STEP_CLASS}>
          {labels.previousPage}
        </button>
        <span>{labels.pageOf(query.page, pageCount)}</span>
        <button type="button" disabled={query.page >= pageCount} onClick={() => onChange({ page: query.page + 1 })} className={STEP_CLASS}>
          {labels.nextPage}
        </button>
      </div>
    </nav>
  )
}
