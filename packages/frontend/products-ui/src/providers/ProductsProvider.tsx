import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { DEFAULT_PRODUCTS_CONFIG, type ProductOptionalField, type ProductsApi, type ProductsConfig } from './types'

type ProductsContextValue = {
  readonly api: ProductsApi
  readonly config: ProductsConfig
}

const ProductsContext = createContext<ProductsContextValue | null>(null)

export type ProductsProviderProps = {
  readonly api: ProductsApi
  readonly config?: Partial<ProductsConfig>
  readonly children: ReactNode
}

export function ProductsProvider({ api, config, children }: ProductsProviderProps) {
  const value = useMemo<ProductsContextValue>(
    () => ({ api, config: { ...DEFAULT_PRODUCTS_CONFIG, ...config } }),
    [api, config],
  )

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
}

export function useProducts(): ProductsApi {
  return useProductsContext().api
}

export function useProductsConfig(): ProductsConfig {
  return useProductsContext().config
}

// Saber se um campo de vertical está ligado é decisão de renderização de mais de um componente
// (formulário e lista, hoje); centralizar evita que cada um invente sua própria checagem.
export function useIsProductFieldEnabled(): (field: ProductOptionalField) => boolean {
  const { fields } = useProductsConfig()
  return useMemo(() => {
    const enabled = new Set(fields)
    return (field: ProductOptionalField) => enabled.has(field)
  }, [fields])
}

function useProductsContext(): ProductsContextValue {
  const value = useContext(ProductsContext)
  if (!value) {
    throw new Error('useProducts() must be used within a <ProductsProvider>')
  }
  return value
}
