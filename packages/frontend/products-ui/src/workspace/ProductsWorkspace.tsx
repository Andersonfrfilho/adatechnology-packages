import { Trash2, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

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
  const { closeDraft } = workspace

  // Enquanto o painel cobre a lista, o Esc e a unica saida que nao exige achar o botao: num formulario
  // longo, em tela estreita, ele e o que separa "fechei" de "estou preso".
  useEffect(() => {
    if (!isDraftOpen) return undefined

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') closeDraft()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDraftOpen, closeDraft])

  return (
    <div className="flex flex-col h-full">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mr-auto">{labels.title}</h1>
        {renderHeaderActions?.()}
      </header>

      <WorkspaceAreaNav area={area} labels={labels} onSelect={handleSelectArea} />

      {/* `relative` ancora o painel de edição, que abaixo de `wide:` cobre a lista em vez de dividir a
          linha com ela. Dividir só funciona quando sobra largura para as duas: a 1024px a barra de
          catálogos e o painel comiam 704px e restavam 320px de tabela, e abaixo disso o painel de
          largura total zerava a lista — clicar em "Novo produto" fazia os produtos sumirem da tela.
          `overflow-hidden` mantém a rolagem dentro de cada coluna, nunca na janela inteira. */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {area === PRODUCTS_WORKSPACE_AREA.CATALOGS ? (
          <main className="flex-1 min-w-0 overflow-y-auto p-4">
            <CatalogList showSortOrder />
          </main>
        ) : (
          <ProductsArea labels={labels} workspace={workspace} />
        )}

        {isDraftOpen ? (
          <>
            {/* Fundo clicável só enquanto o painel flutua: em `wide:` ele volta a ser coluna e não há
                nada por fora para fechar. `tabIndex={-1}` porque o teclado já tem o botão Fechar e o
                Esc — um alvo a mais no Tab seria ruído sem destino. */}
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={workspace.closeDraft}
              className="absolute inset-0 z-10 bg-gray-900/20 wide:hidden"
            />
            <section
              aria-label={isEditing ? labels.editTitle : labels.createTitle}
              className="absolute inset-y-0 right-0 z-20 flex w-full max-w-full flex-col bg-white shadow-2xl desktop:w-[28rem] dark:bg-gray-900 wide:static wide:z-auto wide:shrink-0 wide:border-l wide:border-gray-200 wide:shadow-none wide:dark:border-gray-700"
            >
              {/* Cabeçalho fora da área de rolagem: o formulário é longo, e "Fechar" que sobe junto com
                  o scroll deixa o painel sem saída visível a meio caminho. */}
              <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
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

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <ProductForm
                  onSubmit={workspace.submitDraft}
                  catalogs={workspace.catalogs}
                  sections={sections}
                  {...(workspace.draft ? { initialValues: workspace.draft } : {})}
                  {...(onScanBarcode ? { onScanBarcode } : {})}
                  {...(onSearchSuggestions ? { onSearchSuggestions } : {})}
                />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
