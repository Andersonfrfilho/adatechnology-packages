import { Plus, Search, Upload } from 'lucide-react'
import { useState } from 'react'

import { BulkImport } from '../BulkImport'
import { CatalogList } from '../CatalogList'
import { ProductList } from '../ProductList'
import { useProducts } from '../providers/ProductsProvider'
import type { ProductsWorkspaceLabels } from './labels'
import type { useProductsWorkspace } from './useProductsWorkspace'

export type ProductsAreaProps = {
  readonly labels: ProductsWorkspaceLabels
  readonly workspace: ReturnType<typeof useProductsWorkspace>
}

const BUTTON_CLASS =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-11'
const BUTTON_SECONDARY = `${BUTTON_CLASS} border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800`
const BUTTON_PRIMARY = `${BUTTON_CLASS} bg-brand-600 text-white hover:bg-brand-700`

/**
 * Área de produtos: filtro por catálogo à esquerda, busca e lista à direita.
 *
 * As ações vivem aqui, e não no cabeçalho da tela: "Novo produto" e "Importar CSV" não significam
 * nada enquanto se edita catálogo, e botão que não faz sentido na área aberta é convite a erro.
 */
export function ProductsArea({ labels, workspace }: ProductsAreaProps) {
  const api = useProducts()
  const [importing, setImporting] = useState(false)

  return (
    // `min-w-0` porque filho de flex não encolhe abaixo do conteúdo por padrão: a tabela de produtos
    // é larga, e sem isto ela empurrava o painel de edição para fora da janela.
    <div className="flex flex-1 min-h-0 min-w-0 flex-col desktop:flex-row">
      <aside className="desktop:w-64 shrink-0 border-b desktop:border-b-0 desktop:border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-3">
        <CatalogList
          variant="sidebar"
          selectedId={workspace.catalogId}
          onSelect={workspace.setCatalogId}
          showNoneOption
        />
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            />
            <input
              type="search"
              value={workspace.search}
              onChange={(event) => workspace.setSearch(event.target.value)}
              placeholder={labels.search}
              aria-label={labels.search}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setImporting((value) => !value)}
            aria-expanded={importing}
            className={`${BUTTON_SECONDARY} ml-auto`}
          >
            <Upload aria-hidden="true" className="w-4 h-4" />
            {labels.bulkImport}
          </button>
          <button type="button" onClick={() => workspace.openDraft(null)} className={BUTTON_PRIMARY}>
            <Plus aria-hidden="true" className="w-4 h-4" />
            {labels.newProduct}
          </button>
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

        <ProductList selectable products={workspace.products} onSelect={workspace.openDraft} />

        <Pagination labels={labels} workspace={workspace} />
      </main>
    </div>
  )
}

function Pagination({ labels, workspace }: ProductsAreaProps) {
  if (workspace.totalPages <= 1) return null

  return (
    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
      <button
        type="button"
        disabled={workspace.page <= 1}
        onClick={() => workspace.setPage(workspace.page - 1)}
        className={`${BUTTON_SECONDARY} disabled:opacity-40`}
      >
        {labels.previousPage}
      </button>
      <span>{labels.rangeOf(workspace.page, workspace.totalPages, workspace.total)}</span>
      <button
        type="button"
        disabled={workspace.page >= workspace.totalPages}
        onClick={() => workspace.setPage(workspace.page + 1)}
        className={`${BUTTON_SECONDARY} disabled:opacity-40`}
      >
        {labels.nextPage}
      </button>
    </div>
  )
}
