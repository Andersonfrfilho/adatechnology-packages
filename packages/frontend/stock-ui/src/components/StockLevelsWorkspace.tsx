/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Saldos da empresa, crítico primeiro (abaixo do mínimo), com filtro, paginação no servidor e o
 * painel do insumo a um clique.
 */

import { Pagination, useAsyncResource, formatDateTime, formatQuantity, useRecipesText } from '@adatechnology/recipes-ui'
import type { StockLevelView } from '@adatechnology/stock-contracts'
import { useState } from 'react'

import { useStockApi, useStockText } from '../providers/StockProvider'
import { IngredientStockButton } from './IngredientStockButton'

export function levelStatus(level: StockLevelView): 'negative' | 'below' | 'ok' {
  if (level.quantity.startsWith('-')) return 'negative'
  return level.isBelowMinimum ? 'below' : 'ok'
}

export function StockLevelsWorkspace() {
  const api = useStockApi()
  const { messages } = useStockText()
  const recipesText = useRecipesText()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [onlyBelow, setOnlyBelow] = useState(false)
  const levels = useAsyncResource(
    () => api.listLevels({ page, pageSize, ...(onlyBelow ? { belowMinimum: true } : {}) }),
    `${page}:${pageSize}:${onlyBelow}`,
  )
  const rows = levels.data?.data ?? []
  const statusLabel = { negative: messages.statusNegative, below: messages.statusBelow, ok: messages.statusOk }

  return (
    <section className="arc-root arc-workspace" aria-labelledby="ast-levels-title">
      <h1 className="arc-title" id="ast-levels-title">
        {messages.levelsTitle}
      </h1>
      <div className="arc-toolbar">
        <button
          type="button"
          className={`arc-filter-chip${onlyBelow ? ' arc-filter-chip--on' : ''}`}
          aria-pressed={onlyBelow}
          onClick={() => {
            setOnlyBelow((value) => !value)
            setPage(1)
          }}
        >
          {messages.onlyBelowMinimum}
        </button>
        <span className="arc-total" aria-live="polite">
          {levels.data ? recipesText.format('resultCount', { count: levels.data.pagination.total }) : ''}
        </span>
      </div>
      {levels.error ? (
        <div className="arc-empty" role="alert">
          <p>{messages.loadError}</p>
          <button type="button" className="arc-button arc-button--ghost" onClick={levels.reload}>
            {messages.retry}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="arc-empty">{levels.isLoading ? messages.loading : messages.emptyLevels}</p>
      ) : (
        <div className="arc-table-wrap">
          <table className="arc-table arc-table--cards">
            <thead>
              <tr>
                <th scope="col">{messages.columnIngredient}</th>
                <th scope="col">{messages.columnQuantity}</th>
                <th scope="col">{messages.columnMinimum}</th>
                <th scope="col">{messages.columnStatus}</th>
                <th scope="col">{messages.columnUpdatedAt}</th>
                <th scope="col">
                  <span className="arc-visually-hidden">{messages.stockButton}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((level) => {
                const status = levelStatus(level)
                const unit = recipesText.messages[`unit_${level.unit}`]
                return (
                  <tr key={level.ingredientId}>
                    <td data-label={messages.columnIngredient}>{level.ingredientName ?? level.ingredientId}</td>
                    <td data-label={messages.columnQuantity} className="arc-number">{`${formatQuantity({ value: level.quantity, locale: recipesText.locale })} ${unit}`}</td>
                    <td data-label={messages.columnMinimum} className="arc-number">
                      {level.minimumQuantity === null ? messages.noMinimum : `${formatQuantity({ value: level.minimumQuantity, locale: recipesText.locale })} ${unit}`}
                    </td>
                    <td data-label={messages.columnStatus}>
                      <span className={`arc-chip ast-status ast-status--${status}`}>{statusLabel[status]}</span>
                    </td>
                    <td data-label={messages.columnUpdatedAt}>{formatDateTime({ value: level.updatedAt, locale: recipesText.locale })}</td>
                    <td>
                      <IngredientStockButton ingredientId={level.ingredientId} ingredientName={level.ingredientName ?? ''} onChanged={levels.reload} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        id="ast-levels-pagination"
        page={page}
        totalPages={levels.data?.pagination.totalPages ?? 1}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />
    </section>
  )
}
