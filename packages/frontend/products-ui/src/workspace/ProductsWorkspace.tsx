import { Trash2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { CatalogList } from '../CatalogList'
import { ProductForm } from '../ProductForm'
import type { ProductFormProps } from '../ProductForm'
import type { Section } from '../providers/types'
import { DEFAULT_PRODUCTS_WORKSPACE_LABELS, type ProductsWorkspaceLabels } from './labels'
import { ProductsArea } from './ProductsArea'
import { useProductsWorkspace } from './useProductsWorkspace'
import { WorkspaceAreaNav } from './WorkspaceAreaNav'
import { PRODUCTS_WORKSPACE_AREA, type ProductsWorkspaceArea } from './workspace.constant'

export type ProductsWorkspaceProps = {
  readonly labels?: Partial<ProductsWorkspaceLabels>
  /** Seções vêm do host: nem toda instalação as usa, e o módulo não as expõe em rota própria. */
  readonly sections?: readonly Section[]
  readonly onScanBarcode?: ProductFormProps['onScanBarcode']
  readonly onSearchSuggestions?: ProductFormProps['onSearchSuggestions']
  /** Ações do produto no cabeçalho (publicar na Meta, exportar). Ausente, nada é desenhado. */
  readonly renderHeaderActions?: () => ReactNode
  /**
   * Área aberta, controlada pelo host — é assim que ela vai para a query string e sobrevive ao
   * refresh e ao link colado. Sem `onAreaChange` a tela controla a própria área internamente.
   */
  readonly area?: ProductsWorkspaceArea
  readonly onAreaChange?: (area: ProductsWorkspaceArea) => void
}

const BUTTON_CLASS =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-11'

export function ProductsWorkspace({
  labels: labelsOverride,
  sections = [],
  onScanBarcode,
  onSearchSuggestions,
  renderHeaderActions,
  area: areaProp,
  onAreaChange,
}: ProductsWorkspaceProps) {
  const labels = { ...DEFAULT_PRODUCTS_WORKSPACE_LABELS, ...labelsOverride }
  const workspace = useProductsWorkspace()
  const [internalArea, setInternalArea] = useState<ProductsWorkspaceArea>(PRODUCTS_WORKSPACE_AREA.PRODUCTS)

  const area = areaProp ?? internalArea

  function handleSelectArea(next: ProductsWorkspaceArea): void {
    setInternalArea(next)
    onAreaChange?.(next)
  }

  const isEditing = Boolean(workspace.draft)
  const isDraftOpen = workspace.draft !== undefined

  return (
    <div className="flex flex-col h-full">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mr-auto">{labels.title}</h1>
        {renderHeaderActions?.()}
      </header>

      <WorkspaceAreaNav area={area} labels={labels} onSelect={handleSelectArea} />

      {/* `overflow-hidden` porque a linha tem dois filhos que querem largura fixa (barra de catálogos
          e painel de edição): sem isto a soma passa da janela e a tela inteira ganha rolagem
          horizontal, com o formulário do produto nascendo fora da margem direita. */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {area === PRODUCTS_WORKSPACE_AREA.CATALOGS ? (
          <main className="flex-1 min-w-0 overflow-y-auto p-4">
            <CatalogList showSortOrder />
          </main>
        ) : (
          <ProductsArea labels={labels} workspace={workspace} />
        )}

        {isDraftOpen ? (
          <section
            aria-label={isEditing ? labels.editTitle : labels.createTitle}
            className="w-full desktop:w-[28rem] max-w-full shrink-0 border-t desktop:border-t-0 desktop:border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mr-auto">
                {isEditing ? labels.editTitle : labels.createTitle}
              </h2>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    if (workspace.draft && window.confirm(labels.removeConfirm(workspace.draft.name))) {
                      void workspace.removeDraft()
                    }
                  }}
                  className={`${BUTTON_CLASS} text-red-700 hover:bg-red-50`}
                >
                  <Trash2 aria-hidden="true" className="w-4 h-4" />
                  {labels.remove}
                </button>
              )}
              <button
                type="button"
                onClick={workspace.closeDraft}
                className={`${BUTTON_CLASS} text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800`}
              >
                <X aria-hidden="true" className="w-4 h-4" />
                {labels.close}
              </button>
            </div>
            <ProductForm
              onSubmit={workspace.submitDraft}
              catalogs={workspace.catalogs}
              sections={sections}
              {...(workspace.draft ? { initialValues: workspace.draft } : {})}
              {...(onScanBarcode ? { onScanBarcode } : {})}
              {...(onSearchSuggestions ? { onSearchSuggestions } : {})}
            />
          </section>
        ) : null}
      </div>
    </div>
  )
}
