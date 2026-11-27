import { ArrowDown, ArrowUp, ChevronsUpDown, ImageIcon } from 'lucide-react'

import { formatMoney, type MoneyFormat } from '../lib/money'
import { PRODUCT_SORT_FIELD, type Product, type ProductSortField } from '../providers/types'
import { sortDirectionOf } from './listQuery'
import type { ProductsListingLabels } from './listing.labels'
import type { ProductsListQuery } from './listing.types'

export type ProductsTableProps = {
  readonly labels: ProductsListingLabels
  readonly products: readonly Product[]
  readonly query: ProductsListQuery
  readonly selectedIds: ReadonlySet<string>
  readonly moneyFormat: MoneyFormat
  readonly priceOnRequestLabel: string
  readonly showSection: boolean
  readonly showSortOrder: boolean
  readonly onSort: (field: ProductSortField) => void
  readonly onToggle: (id: string) => void
  readonly onTogglePage: () => void
  readonly onOpen: (product: Product) => void
}

const HEAD_CLASS = 'px-3 py-3 text-xs font-medium uppercase whitespace-nowrap text-gray-500'
const CELL_CLASS = 'px-3 py-2'

function Thumbnail({ product }: { readonly product: Product }) {
  if (product.imageUrl) {
    return <img src={product.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-gray-100 object-cover" />
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
      <ImageIcon aria-hidden="true" className="h-4 w-4" />
    </span>
  )
}

function AvailabilityBadge({ product, labels }: { readonly product: Product; readonly labels: ProductsListingLabels }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${product.active ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-600'}`}
    >
      {product.active ? labels.yes : labels.no}
    </span>
  )
}

function priceText(product: Product, format: MoneyFormat, onRequestLabel: string): string {
  return product.priceInCents === null ? onRequestLabel : formatMoney(product.priceInCents, format)
}

export function ProductsTable(props: ProductsTableProps) {
  const { labels, products, query, selectedIds, moneyFormat, priceOnRequestLabel, showSection, showSortOrder } = props
  const selectedOnPage = products.filter((product) => selectedIds.has(product.id)).length
  const isAllSelected = products.length > 0 && selectedOnPage === products.length

  function renderSortHeader(field: ProductSortField, text: string, alignment: string) {
    const direction = sortDirectionOf(query, field)
    const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ChevronsUpDown
    const state =
      direction === 'asc' ? labels.sortAscending : direction === 'desc' ? labels.sortDescending : labels.sortNeutral
    return (
      <th
        scope="col"
        aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
        className={`${HEAD_CLASS} ${alignment}`}
      >
        <button
          type="button"
          onClick={() => props.onSort(field)}
          aria-label={`${text}, ${state}`}
          className="inline-flex min-h-11 items-center gap-1 uppercase"
        >
          {text}
          <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${direction ? 'text-brand-600' : 'text-gray-400'}`} />
        </button>
      </th>
    )
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th scope="col" className={`${HEAD_CLASS} w-10`}>
                <input
                  type="checkbox"
                  aria-label={labels.selectAll}
                  checked={isAllSelected}
                  ref={(box) => {
                    if (box) box.indeterminate = selectedOnPage > 0 && !isAllSelected
                  }}
                  onChange={props.onTogglePage}
                  className="h-5 w-5 accent-brand-600"
                />
              </th>
              <th scope="col" className={HEAD_CLASS}>
                {labels.columnImage}
              </th>
              {renderSortHeader(PRODUCT_SORT_FIELD.NAME, labels.columnName, 'text-left')}
              {renderSortHeader(PRODUCT_SORT_FIELD.CATALOG, labels.columnCatalog, 'text-left')}
              {showSection ? renderSortHeader(PRODUCT_SORT_FIELD.SECTION, labels.columnSection, 'text-left') : null}
              {renderSortHeader(PRODUCT_SORT_FIELD.PRICE, labels.columnPrice, 'text-right')}
              {renderSortHeader(PRODUCT_SORT_FIELD.ACTIVE, labels.columnAvailable, 'text-center')}
              {showSortOrder ? renderSortHeader(PRODUCT_SORT_FIELD.SORT_ORDER, labels.columnOrder, 'text-right') : null}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr
                key={product.id}
                onClick={() => props.onOpen(product)}
                className={`cursor-pointer odd:bg-white even:bg-gray-50 hover:bg-brand-50 ${selectedIds.has(product.id) ? 'bg-brand-50' : ''}`}
              >
                <td className={CELL_CLASS} onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={labels.selectRow(product.name)}
                    checked={selectedIds.has(product.id)}
                    onChange={() => props.onToggle(product.id)}
                    className="h-5 w-5 accent-brand-600"
                  />
                </td>
                <td className={CELL_CLASS}>
                  <Thumbnail product={product} />
                </td>
                <td className={`${CELL_CLASS} max-w-[16rem] truncate font-medium text-gray-900`}>{product.name}</td>
                <td className={`${CELL_CLASS} max-w-[10rem] truncate text-gray-600`}>{product.catalogName ?? '—'}</td>
                {showSection ? (
                  <td className={`${CELL_CLASS} max-w-[10rem] truncate text-gray-600`}>{product.sectionName ?? '—'}</td>
                ) : null}
                <td className={`${CELL_CLASS} whitespace-nowrap text-right font-mono text-gray-700`}>
                  {priceText(product, moneyFormat, priceOnRequestLabel)}
                </td>
                <td className={`${CELL_CLASS} text-center`}>
                  <AvailabilityBadge product={product} labels={labels} />
                </td>
                {showSortOrder ? (
                  <td className={`${CELL_CLASS} text-right font-mono text-gray-600`}>{product.sortOrder}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {products.map((product) => (
          <li
            key={product.id}
            className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 odd:bg-white even:bg-gray-50"
          >
            <input
              type="checkbox"
              aria-label={labels.selectRow(product.name)}
              checked={selectedIds.has(product.id)}
              onChange={() => props.onToggle(product.id)}
              className="mt-1 h-5 w-5 shrink-0 accent-brand-600"
            />
            <button
              type="button"
              onClick={() => props.onOpen(product)}
              className="flex min-w-0 flex-1 items-start gap-3 text-left"
            >
              <Thumbnail product={product} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-gray-900">{product.name}</span>
                <span className="block truncate text-xs text-gray-500">
                  {[product.catalogName, showSection ? product.sectionName : undefined].filter(Boolean).join(' · ') ||
                    '—'}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-gray-700">
                    {priceText(product, moneyFormat, priceOnRequestLabel)}
                  </span>
                  <AvailabilityBadge product={product} labels={labels} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
