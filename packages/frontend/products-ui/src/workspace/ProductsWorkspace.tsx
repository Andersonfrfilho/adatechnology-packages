import { useState, type ReactNode } from 'react'

import { BulkImport } from '../BulkImport'
import { CatalogList } from '../CatalogList'
import { ProductForm } from '../ProductForm'
import { ProductList } from '../ProductList'
import { useProducts } from '../providers/ProductsProvider'
import type { ProductFormProps } from '../ProductForm'
import type { Section } from '../providers/types'
import { DEFAULT_PRODUCTS_WORKSPACE_LABELS, type ProductsWorkspaceLabels } from './labels'
import { useProductsWorkspace } from './useProductsWorkspace'

type WorkspaceTab = 'products' | 'catalogs'

export type ProductsWorkspaceProps = {
  readonly labels?: Partial<ProductsWorkspaceLabels>
  /** Seções vêm do host: nem toda instalação as usa, e o módulo não as expõe em rota própria. */
  readonly sections?: readonly Section[]
  readonly onScanBarcode?: ProductFormProps['onScanBarcode']
  readonly onSearchSuggestions?: ProductFormProps['onSearchSuggestions']
  /** Ações do produto no cabeçalho (publicar na Meta, exportar). Ausente, nada é desenhado. */
  readonly renderHeaderActions?: () => ReactNode
}

const BUTTON_CLASS = 'px-3 py-2 rounded-lg text-sm font-medium transition-colors'

export function ProductsWorkspace({
  labels: labelsOverride,
  sections = [],
  onScanBarcode,
  onSearchSuggestions,
  renderHeaderActions,
}: ProductsWorkspaceProps) {
  const labels = { ...DEFAULT_PRODUCTS_WORKSPACE_LABELS, ...labelsOverride }
  const api = useProducts()
  const workspace = useProductsWorkspace()
  const [tab, setTab] = useState<WorkspaceTab>('products')
  const [importing, setImporting] = useState(false)

  const isEditing = Boolean(workspace.draft)
  const isDraftOpen = workspace.draft !== undefined

  return (
    <div className="flex flex-col h-full">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900 mr-auto">{labels.title}</h1>
        {renderHeaderActions?.()}
        <button
          type="button"
          onClick={() => setImporting((value) => !value)}
          className={`${BUTTON_CLASS} border border-gray-300 text-gray-700 hover:bg-gray-50`}
        >
          {labels.bulkImport}
        </button>
        <button
          type="button"
          onClick={() => workspace.openDraft(null)}
          className={`${BUTTON_CLASS} bg-brand-600 text-white hover:bg-brand-700`}
        >
          {labels.newProduct}
        </button>
      </header>

      <div className="flex flex-1 min-h-0 flex-col desktop:flex-row">
        <aside className="desktop:w-64 shrink-0 border-b desktop:border-b-0 desktop:border-r border-gray-200 overflow-y-auto">
          <CatalogList
            variant="sidebar"
            selectedId={workspace.catalogId}
            onSelect={workspace.setCatalogId}
            showNoneOption
          />
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={workspace.search}
              onChange={(event) => workspace.setSearch(event.target.value)}
              placeholder={labels.search}
              aria-label={labels.search}
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <nav className="ml-auto flex gap-1" aria-label={labels.title}>
              {(['products', 'catalogs'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  aria-pressed={tab === value}
                  className={`${BUTTON_CLASS} ${tab === value ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {value === 'products' ? labels.productsTab : labels.catalogsTab}
                </button>
              ))}
            </nav>
          </div>

          {importing && (
            <BulkImport
              onImport={async (file) => {
                const result = await api.bulkImportProducts(file)
                workspace.reload()
                return result
              }}
            />
          )}

          {workspace.error && (
            <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
              {labels.loadFailure}
            </p>
          )}

          {tab === 'catalogs' ? (
            <CatalogList showSortOrder />
          ) : (
            <>
              <ProductList selectable products={workspace.products} onSelect={workspace.openDraft} />
              <Pagination labels={labels} workspace={workspace} />
            </>
          )}
        </main>

        {isDraftOpen ? (
          <section
            aria-label={isEditing ? labels.editTitle : labels.createTitle}
            className="desktop:w-[28rem] shrink-0 border-t desktop:border-t-0 desktop:border-l border-gray-200 overflow-y-auto p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-900 mr-auto">
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
                  {labels.remove}
                </button>
              )}
              <button
                type="button"
                onClick={workspace.closeDraft}
                className={`${BUTTON_CLASS} text-gray-600 hover:bg-gray-100`}
              >
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

function Pagination({
  labels,
  workspace,
}: {
  readonly labels: ProductsWorkspaceLabels
  readonly workspace: ReturnType<typeof useProductsWorkspace>
}) {
  if (workspace.totalPages <= 1) return null

  return (
    <div className="flex items-center gap-3 text-sm text-gray-600">
      <button
        type="button"
        disabled={workspace.page <= 1}
        onClick={() => workspace.setPage(workspace.page - 1)}
        className={`${BUTTON_CLASS} border border-gray-300 disabled:opacity-40`}
      >
        {labels.previousPage}
      </button>
      <span>{labels.rangeOf(workspace.page, workspace.totalPages, workspace.total)}</span>
      <button
        type="button"
        disabled={workspace.page >= workspace.totalPages}
        onClick={() => workspace.setPage(workspace.page + 1)}
        className={`${BUTTON_CLASS} border border-gray-300 disabled:opacity-40`}
      >
        {labels.nextPage}
      </button>
    </div>
  )
}
