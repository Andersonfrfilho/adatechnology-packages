import { useState, useCallback } from 'react'
import type { Product, ProductSyncStatus, ProductsApi } from './providers/types'
import { PRODUCT_OPTIONAL_FIELD, PRODUCT_SYNC_STATUS } from './providers/types'
import { useIsProductFieldEnabled, useProducts, useProductsConfig } from './providers/ProductsProvider'
import { formatBarcode } from './lib/format'
import { formatMarginPercent, formatMoney } from './lib/money'

export type ProductListProps = {
  readonly onSelect?: (product: Product) => void
  readonly selectable?: boolean
  readonly products?: readonly Product[]
  readonly api?: ProductsApi
}

type SortField = 'name' | 'price' | 'unit' | 'catalogName' | 'barcode' | 'active' | 'inventory'
type SortDir = 'asc' | 'desc'

const HEADER_CLASS = 'px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase'
const SORTABLE_CLASS = `${HEADER_CLASS} cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200`

const SYNC_STATUS_BADGE: Record<ProductSyncStatus, { readonly label: string; readonly className: string }> = {
  [PRODUCT_SYNC_STATUS.PENDING]: { label: 'Pendente', className: 'bg-amber-100 text-amber-800' },
  [PRODUCT_SYNC_STATUS.SYNCED]: { label: 'Sincronizado', className: 'bg-green-100 text-green-800' },
  [PRODUCT_SYNC_STATUS.FAILED]: { label: 'Falhou', className: 'bg-red-100 text-red-800' },
}

function SortIcon({ field, currentField, currentDir }: { field: SortField; currentField: SortField | null; currentDir: SortDir }) {
  if (field !== currentField) {
    return <span className="text-gray-300 ml-1 text-xs">↕</span>
  }
  return <span className="text-brand-600 ml-1 text-xs">{currentDir === 'asc' ? '↑' : '↓'}</span>
}

export function ProductList({ onSelect, selectable = false, products: externalProducts, api }: ProductListProps) {
  const contextApi = useProducts()
  const config = useProductsConfig()
  const isFieldEnabled = useIsProductFieldEnabled()
  const resolvedApi = api ?? contextApi

  const [internalProducts, setInternalProducts] = useState<readonly Product[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const products = externalProducts ?? internalProducts

  const loadProducts = useCallback(async () => {
    if (externalProducts || loaded) return
    setLoading(true)
    try {
      const result = await resolvedApi.listProducts()
      setInternalProducts(result.data)
      setLoaded(true)
    } catch {
      setInternalProducts([])
    } finally {
      setLoading(false)
    }
  }, [externalProducts, loaded, resolvedApi])

  if (!externalProducts && !loaded) {
    loadProducts()
  }

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }, [sortField])

  const sortedProducts = [...products].sort((a, b) => {
    if (!sortField) return 0
    const dir = sortDir === 'asc' ? 1 : -1

    switch (sortField) {
      case 'name':
        return a.name.localeCompare(b.name) * dir
      case 'price':
        return (a.priceInCents - b.priceInCents) * dir
      case 'unit':
        return (a.unit ?? '').localeCompare(b.unit ?? '') * dir
      case 'catalogName':
        return (a.catalogName ?? '').localeCompare(b.catalogName ?? '') * dir
      case 'barcode':
        return (a.barcode ?? '').localeCompare(b.barcode ?? '') * dir
      case 'active':
        return (Number(a.active) - Number(b.active)) * dir
      case 'inventory':
        return ((a.inventory ?? 0) - (b.inventory ?? 0)) * dir
      default:
        return 0
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
        Nenhum produto encontrado
      </div>
    )
  }

  const moneyFormat = { currency: config.currency, locale: config.locale }
  const showCostPrice = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.COST_PRICE)
  const showUnit = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.UNIT)
  const showBarcode = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.BARCODE)
  const showInventory = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.INVENTORY)
  // Estado de sincronização não é um campo do produto que o host escolhe exibir: ele existe se, e
  // só se, o host publica na Meta. Uma flag só, em `metaSync`, evita a tela mostrar coluna vazia.
  const showSyncStatus = config.metaSync?.products === true

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <th className={`${HEADER_CLASS} text-left`}>Img</th>
            <th className={`${SORTABLE_CLASS} text-left`} onClick={() => handleSort('name')}>
              Nome <SortIcon field="name" currentField={sortField} currentDir={sortDir} />
            </th>
            <th className={`${SORTABLE_CLASS} text-right`} onClick={() => handleSort('price')}>
              Preço <SortIcon field="price" currentField={sortField} currentDir={sortDir} />
            </th>
            {showCostPrice && <th className={`${HEADER_CLASS} text-center`}>Mg%</th>}
            {showUnit && (
              <th className={`${SORTABLE_CLASS} text-left`} onClick={() => handleSort('unit')}>
                Un <SortIcon field="unit" currentField={sortField} currentDir={sortDir} />
              </th>
            )}
            <th className={`${SORTABLE_CLASS} text-left`} onClick={() => handleSort('catalogName')}>
              Catálogo <SortIcon field="catalogName" currentField={sortField} currentDir={sortDir} />
            </th>
            {showBarcode && (
              <th className={`${SORTABLE_CLASS} text-left`} onClick={() => handleSort('barcode')}>
                Cód.barras <SortIcon field="barcode" currentField={sortField} currentDir={sortDir} />
              </th>
            )}
            <th className={`${SORTABLE_CLASS} text-center`} onClick={() => handleSort('active')}>
              Ativo <SortIcon field="active" currentField={sortField} currentDir={sortDir} />
            </th>
            {showInventory && (
              <th className={`${SORTABLE_CLASS} text-right`} onClick={() => handleSort('inventory')}>
                Estoque <SortIcon field="inventory" currentField={sortField} currentDir={sortDir} />
              </th>
            )}
            {showSyncStatus && <th className={`${HEADER_CLASS} text-center`}>Catálogo Meta</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {sortedProducts.map((product) => (
            <tr
              key={product.id}
              className={`hover:bg-gray-50 transition-colors ${selectable ? 'cursor-pointer' : ''}`}
              onClick={() => selectable && onSelect?.(product)}
            >
              <td className="px-3 py-3">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-800"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 dark:text-gray-500">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
              </td>
              <td className="px-3 py-3 font-medium text-gray-900 dark:text-gray-100 max-w-[200px] truncate">
                {product.name}
              </td>
              <td className="px-3 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                {formatMoney(product.priceInCents, moneyFormat)}
              </td>
              {showCostPrice && (
                <td className="px-3 py-3 text-center text-gray-500 dark:text-gray-400">
                  {product.costPriceInCents
                    ? formatMarginPercent(product.costPriceInCents, product.priceInCents)
                    : '—'}
                </td>
              )}
              {showUnit && <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{product.unit ?? '—'}</td>}
              <td className="px-3 py-3 text-gray-600 dark:text-gray-400 max-w-[120px] truncate">
                {product.catalogName ?? '—'}
              </td>
              {showBarcode && (
                <td className="px-3 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                  {product.barcode ? formatBarcode(product.barcode) : '—'}
                </td>
              )}
              <td className="px-3 py-3 text-center">
                {product.active ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Sim
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    Não
                  </span>
                )}
              </td>
              {showInventory && (
                <td className="px-3 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                  {product.inventory ?? '—'}
                </td>
              )}
              {showSyncStatus && (
                <td className="px-3 py-3 text-center">
                  <SyncStatusBadge status={product.syncStatus} error={product.syncError} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// O motivo da falha vai no `title` em vez de numa coluna própria: a mensagem da Graph API é longa
// e só interessa quando alguém está investigando aquele item.
function SyncStatusBadge({ status, error }: { status?: ProductSyncStatus | null; error?: string | null }) {
  if (!status) return <span className="text-gray-400 dark:text-gray-500">—</span>

  const badge = SYNC_STATUS_BADGE[status]
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
      {...(status === PRODUCT_SYNC_STATUS.FAILED && error ? { title: error } : {})}
    >
      {badge.label}
    </span>
  )
}
