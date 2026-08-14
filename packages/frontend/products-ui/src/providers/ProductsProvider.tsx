import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  DEFAULT_PRODUCTS_CONFIG,
  PRODUCT_SURFACE,
  isProductFieldRequired,
  isProductFieldVisible,
  resolveProductFields,
  resolveProductLabel,
  type ProductField,
  type ProductOptionalField,
  type ProductsApi,
  type ProductsConfig,
  type ProductSurface,
} from './types'

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

/**
 * Saber se um campo de vertical está ligado é decisão de renderização de mais de um componente
 * (formulário e lista, hoje); centralizar evita que cada um invente sua própria checagem.
 *
 * A superfície é opcional para não quebrar quem já chama o hook sem argumento: sem ela, um campo
 * ligado em qualquer superfície conta como ligado. Componente do pacote sempre informa a sua.
 */
export function useIsProductFieldEnabled(surface?: ProductSurface): (field: ProductOptionalField) => boolean {
  const { fields } = useProductsConfig()
  return useMemo(() => {
    const enabled = new Set(
      surface
        ? resolveProductFields(fields, surface)
        : [
            ...resolveProductFields(fields, PRODUCT_SURFACE.FORM),
            ...resolveProductFields(fields, PRODUCT_SURFACE.LIST),
          ],
    )
    return (field: ProductOptionalField) => enabled.has(field)
  }, [fields, surface])
}

/**
 * Rótulo de um campo na superfície informada, já com o padrão aplicado quando o host não renomeia.
 * Centralizado pelo mesmo motivo do hook acima: dois componentes desenham os mesmos campos.
 */
export function useProductLabel(surface: ProductSurface): (field: ProductField) => string {
  const { labels, fields } = useProductsConfig()
  return useMemo(
    () => (field: ProductField) => resolveProductLabel({ labels, fields, field, surface }),
    [labels, fields, surface],
  )
}

/**
 * Se o campo é desenhado nesta superfície — inclusive os do núcleo, que a tabela por campo pode
 * esconder. `useIsProductFieldEnabled` continua respondendo só pelos campos de vertical.
 */
export function useIsProductFieldVisible(surface: ProductSurface): (field: ProductField) => boolean {
  const { fields } = useProductsConfig()
  return useMemo(
    () => (field: ProductField) => isProductFieldVisible({ fields, field, surface }),
    [fields, surface],
  )
}

/**
 * Se o formulário exige o campo. Núcleo (nome e preço) é sempre exigido, e campo desligado nunca é
 * — exigir o que não se desenha travaria o salvamento sem mostrar onde está o problema.
 */
export function useIsProductFieldRequired(): (field: ProductField) => boolean {
  const { requiredFields, fields } = useProductsConfig()
  return useMemo(
    () => (field: ProductField) => isProductFieldRequired({ requiredFields, fields, field }),
    [requiredFields, fields],
  )
}

function useProductsContext(): ProductsContextValue {
  const value = useContext(ProductsContext)
  if (!value) {
    throw new Error('useProducts() must be used within a <ProductsProvider>')
  }
  return value
}
