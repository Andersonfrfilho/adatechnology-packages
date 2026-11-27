/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Tela composta de insumos: busca, filtro de unidade, ordenação, paginação no servidor, total,
 * exportação (página ou todos do filtro), criar, editar e excluir com confirmação.
 */

import { RECIPE_ERROR_CODES, RECIPE_UNITS, type ExportFormat, type Ingredient } from '@adatechnology/recipe-contracts'
import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { useIngredientList } from '../hooks/useIngredientList'
import { readErrorCode, readErrorDetails } from '../lib/apiError'
import { buildSpreadsheetBlob, downloadBlob } from '../lib/spreadsheetDownload'
import { useRecipesApi, useRecipesText } from '../providers/RecipesProvider'
import { ConfirmDialog } from './ConfirmDialog'
import { ExportMenu, type ExportScope } from './ExportMenu'
import { Feedback } from './Feedback'
import { IngredientDialog } from './IngredientDialog'
import { IngredientTable } from './IngredientTable'
import { ListToolbar } from './ListToolbar'
import { Pagination } from './Pagination'

export type IngredientsWorkspaceProps = {
  /** Ações do host em cada linha (ex.: abrir o estoque do insumo no `stock-ui`). */
  readonly renderRowActions?: (ingredient: Ingredient) => ReactNode
}

type Feedback = { kind: 'success' | 'error'; message: string } | undefined

export function IngredientsWorkspace({ renderRowActions }: IngredientsWorkspaceProps) {
  const api = useRecipesApi()
  const { messages, format, locale } = useRecipesText()
  const list = useIngredientList()
  const [editing, setEditing] = useState<Ingredient | 'new'>()
  const [removing, setRemoving] = useState<Ingredient>()
  const [feedback, setFeedback] = useState<Feedback>()
  const rows = list.data?.data ?? []
  const hasFilters = Boolean(list.state.search || list.state.units.length)

  async function handleExport(scope: ExportScope, exportFormat: ExportFormat): Promise<void> {
    const fileName = `insumos.${exportFormat}`
    if (scope === 'all' && api.exportIngredients) {
      downloadBlob(await api.exportIngredients({ filters: list.filters, format: exportFormat }), fileName)
      return
    }
    const table = {
      header: [messages.columnName, messages.columnUnit, messages.columnCostPerUnit, messages.columnSupplier, messages.columnUpdatedAt],
      rows: rows.map((row) => [row.name, row.unit, Number(row.costPerUnit), row.supplier, row.updatedAt]),
    }
    downloadBlob(buildSpreadsheetBlob(table, exportFormat), fileName)
  }

  async function handleRemove(ingredient: Ingredient): Promise<void> {
    setRemoving(undefined)
    try {
      await api.removeIngredient?.(ingredient.id)
      setFeedback({ kind: 'success', message: messages.removedIngredient })
      list.reload()
    } catch (error) {
      const inUse = readErrorCode(error) === RECIPE_ERROR_CODES.INGREDIENT_IN_USE
      const products = readErrorDetails(error).productIds
      const count = Array.isArray(products) ? products.length : 1
      setFeedback({ kind: 'error', message: inUse ? format('ingredientInUse', { count }) : messages.genericError })
    }
  }

  return (
    <section className="arc-root arc-workspace" aria-labelledby="arc-ingredients-title" lang={locale}>
      <h1 className="arc-title" id="arc-ingredients-title">
        {messages.ingredientsTitle}
      </h1>
      <ListToolbar
        id="arc-ingredients"
        search={list.state.search}
        searchPlaceholder={messages.ingredientsSearchPlaceholder}
        onSearchChange={list.setSearch}
        total={list.data?.pagination.total}
        hasFilters={hasFilters}
        onClearFilters={list.clearFilters}
        filters={
          <div className="arc-field">
            <span className="arc-label" id="arc-unit-filter-label">
              {messages.unitFilterLabel}
            </span>
            <div className="arc-filter" role="group" aria-labelledby="arc-unit-filter-label">
              {RECIPE_UNITS.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  className={`arc-filter-chip${list.state.units.includes(unit) ? ' arc-filter-chip--on' : ''}`}
                  aria-pressed={list.state.units.includes(unit)}
                  onClick={() => list.toggleUnit(unit)}
                >
                  {messages[`unit_${unit}`]}
                </button>
              ))}
            </div>
          </div>
        }
        actions={
          <>
            <ExportMenu onExport={handleExport} canExportAll={Boolean(api.exportIngredients)} />
            {api.createIngredient ? (
              <button type="button" className="arc-button" onClick={() => setEditing('new')}>
                <Plus aria-hidden="true" className="arc-icon" />
                <span>{messages.newIngredient}</span>
              </button>
            ) : null}
          </>
        }
      />
      <Feedback feedback={feedback} />
      {list.error ? (
        <div className="arc-empty" role="alert">
          <p>{messages.loadError}</p>
          <button type="button" className="arc-button arc-button--ghost" onClick={list.reload}>
            {messages.retry}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="arc-empty">{list.isLoading ? messages.loading : hasFilters ? messages.emptyFiltered : messages.emptyIngredients}</p>
      ) : (
        <IngredientTable
          rows={rows}
          sort={list.state.sort}
          order={list.state.order}
          onToggleSort={list.toggleSort}
          {...(api.updateIngredient ? { onEdit: (ingredient: Ingredient) => setEditing(ingredient) } : {})}
          {...(api.removeIngredient ? { onRemove: (ingredient: Ingredient) => setRemoving(ingredient) } : {})}
          {...(renderRowActions ? { renderRowActions } : {})}
        />
      )}
      <Pagination
        id="arc-ingredients-pagination"
        page={list.state.page}
        totalPages={list.data?.pagination.totalPages ?? 1}
        pageSize={list.state.pageSize}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
      />
      {editing ? (
        <IngredientDialog
          {...(editing === 'new' ? {} : { ingredient: editing })}
          onCancel={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            setFeedback({ kind: 'success', message: messages.savedIngredient })
            list.reload()
          }}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          message={format('removeIngredientConfirm', { name: removing.name })}
          confirmLabel={messages.remove}
          isDanger
          onConfirm={() => void handleRemove(removing)}
          onCancel={() => setRemoving(undefined)}
        />
      ) : null}
    </section>
  )
}
