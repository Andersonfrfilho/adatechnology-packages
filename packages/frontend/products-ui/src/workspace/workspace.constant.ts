/**
 * Áreas da tela de catálogo.
 *
 * Produto e catálogo são cadastros diferentes, com colunas, ações e frequência de uso diferentes —
 * empilhar os dois na mesma lista escondia o de baixo. O id é estável e em inglês porque vai para
 * o contrato do componente; quem monta a URL é o host, e ele escolhe o termo que o usuário lê.
 */
export const PRODUCTS_WORKSPACE_AREA = {
  PRODUCTS: 'products',
  CATALOGS: 'catalogs',
} as const

export type ProductsWorkspaceArea = (typeof PRODUCTS_WORKSPACE_AREA)[keyof typeof PRODUCTS_WORKSPACE_AREA]

const AREAS: readonly string[] = Object.values(PRODUCTS_WORKSPACE_AREA)

export function isProductsWorkspaceArea(value: string): value is ProductsWorkspaceArea {
  return AREAS.includes(value)
}
