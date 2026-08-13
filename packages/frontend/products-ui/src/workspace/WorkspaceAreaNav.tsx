import { Layers, Package } from 'lucide-react'

import { PRODUCTS_WORKSPACE_AREA, type ProductsWorkspaceArea } from './workspace.constant'
import type { ProductsWorkspaceLabels } from './labels'

export type WorkspaceAreaNavProps = {
  readonly area: ProductsWorkspaceArea
  readonly labels: ProductsWorkspaceLabels
  readonly onSelect: (area: ProductsWorkspaceArea) => void
}

const ITEM_BASE =
  'flex items-center gap-2 px-3 py-2 -mb-px border-b-2 text-sm font-medium transition-colors min-h-11'
const ITEM_ACTIVE = 'border-brand-600 text-brand-700 dark:text-brand-400'
const ITEM_IDLE =
  'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'

const AREA_ICON = {
  [PRODUCTS_WORKSPACE_AREA.PRODUCTS]: Package,
  [PRODUCTS_WORKSPACE_AREA.CATALOGS]: Layers,
} as const

/**
 * Navegação das áreas, e não um par de botões ao lado da busca.
 *
 * O controle antigo ficava à direita do campo de busca, na altura dos filtros: quem entrava na tela
 * lia "Catálogo", via uma lista de produtos, e não encontrava onde ficavam os catálogos — o único
 * caminho estava disfarçado de filtro. Navegação mora abaixo do título, com ícone e estado ativo
 * visível, porque é isso que ela é.
 */
export function WorkspaceAreaNav({ area, labels, onSelect }: WorkspaceAreaNavProps) {
  return (
    <nav
      aria-label={labels.areaNav}
      className="flex gap-1 px-4 border-b border-gray-200 dark:border-gray-700"
    >
      {(
        [
          [PRODUCTS_WORKSPACE_AREA.PRODUCTS, labels.productsTab],
          [PRODUCTS_WORKSPACE_AREA.CATALOGS, labels.catalogsTab],
        ] as const
      ).map(([value, label]) => {
        const Icon = AREA_ICON[value]

        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            aria-current={value === area ? 'page' : undefined}
            className={`${ITEM_BASE} ${value === area ? ITEM_ACTIVE : ITEM_IDLE}`}
          >
            <Icon aria-hidden="true" className="w-4 h-4 shrink-0" />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
