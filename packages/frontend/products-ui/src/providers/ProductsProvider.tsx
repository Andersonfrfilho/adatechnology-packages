import { createContext, useContext, type ReactNode } from 'react'
import type { ProductsApi } from './types'

const ProductsContext = createContext<ProductsApi | null>(null)

export interface ProductsProviderProps {
  api: ProductsApi
  children: ReactNode
}

export function ProductsProvider({ api, children }: ProductsProviderProps) {
  return (
    <ProductsContext.Provider value={api}>
      {children}
    </ProductsContext.Provider>
  )
}

export function useProducts(): ProductsApi {
  const api = useContext(ProductsContext)
  if (!api) {
    throw new Error('useProducts() must be used within a <ProductsProvider>')
  }
  return api
}
