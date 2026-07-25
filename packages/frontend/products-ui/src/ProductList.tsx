import { useState, useCallback } from 'react'
import type { Product, ProductsApi } from './providers/types'
import { useProducts } from './providers/ProductsProvider'
import { formatBRL, formatMargin, formatBarcode } from './lib/format'

export interface ProductListProps {
  onSelect?: (product: Product) => void
  selectable?: boolean
  products?: Product[]
  api?: ProductsApi
}

type SortField = 'name' | 'price' | 'unit' | 'catalogName' | 'barcode' | 'active' | 'inventory'
type SortDir = 'asc' | 'desc'

function SortIcon({ field, currentField, currentDir }: { field: SortField; currentField: SortField | null; currentDir: SortDir }) {
  if (field !== currentField) {
    return <span className="text-gray-300 ml-1 text-xs">↕</span>
  }
  return <span className="text-brand-600 ml-1 text-xs">{currentDir === 'asc' ? '↑' : '↓'}</span>
}

export function ProductList({ onSelect, selectable = false, products: externalProducts, api }: ProductListProps) {
  const contextApi = useProducts()
  const resolvedApi = api ?? contextApi

  const [internalProducts, setInternalProducts] = useState<Product[]>([])
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
        return (parseFloat(a.price) - parseFloat(b.price)) * dir
      case 'unit':
        return (a.unit ?? '').localeCompare(b.unit ?? '') * dir
      case 'catalogName':
        return (a.catalogName ?? '').localeCompare(b.catalogName ?? '') * dir
      case 'barcode':
        return (a.barcode ?? '').localeCompare(b.barcode ?? '') * dir
      case 'active':
        return (Number(a.active) - Number(b.active)) * dir
      case 'inventory':
        return (a.inventory - b.inventory) * dir
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
      <div className="text-center py-12 text-gray-500 text-sm">
        Nenhum produto encontrado
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Img</th>
            <th
              className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700"
              onClick={() => handleSort('name')}
            >
              Nome <SortIcon field="name" currentField={sortField} currentDir={sortDir} />
            </th>
            <th
              className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700"
              onClick={() => handleSort('price')}
            >
              Preço <SortIcon field="price" currentField={sortField} currentDir={sortDir} />
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mg%</th>
            <th
              className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700"
              onClick={() => handleSort('unit')}
            >
              Un <SortIcon field="unit" currentField={sortField} currentDir={sortDir} />
            </th>
            <th
              className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700"
              onClick={() => handleSort('catalogName')}
            >
              Catálogo <SortIcon field="catalogName" currentField={sortField} currentDir={sortDir} />
            </th>
            <th
              className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700"
              onClick={() => handleSort('barcode')}
            >
              Cód.barras <SortIcon field="barcode" currentField={sortField} currentDir={sortDir} />
            </th>
            <th
              className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700"
              onClick={() => handleSort('active')}
            >
              Ativo <SortIcon field="active" currentField={sortField} currentDir={sortDir} />
            </th>
            <th
              className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700"
              onClick={() => handleSort('inventory')}
            >
              Estoque <SortIcon field="inventory" currentField={sortField} currentDir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sortedProducts.map((product) => (
            <tr
              key={product.id}
              className={`hover:bg-gray-50 transition-colors ${
                selectable ? 'cursor-pointer' : ''
              }`}
              onClick={() => selectable && onSelect?.(product)}
            >
              <td className="px-3 py-3">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-10 h-10 rounded-lg object-cover bg-gray-100"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
              </td>
              <td className="px-3 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                {product.name}
              </td>
              <td className="px-3 py-3 text-right font-mono text-gray-700">
                {formatBRL(product.price)}
              </td>
              <td className="px-3 py-3 text-center text-gray-500">
                {product.costPrice
                  ? formatMargin(parseFloat(product.costPrice), parseFloat(product.price))
                  : '—'}
              </td>
              <td className="px-3 py-3 text-gray-600">{product.unit}</td>
              <td className="px-3 py-3 text-gray-600 max-w-[120px] truncate">
                {product.catalogName ?? '—'}
              </td>
              <td className="px-3 py-3 text-gray-500 font-mono text-xs">
                {product.barcode ? formatBarcode(product.barcode) : '—'}
              </td>
              <td className="px-3 py-3 text-center">
                {product.active ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Sim
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    Não
                  </span>
                )}
              </td>
              <td className="px-3 py-3 text-right font-mono text-gray-700">
                {product.inventory}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
