/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Lista de compras: o host passa os produtos (e, se quiser, origens de quantidades previstas como
 * encomendas); a tela soma os insumos, desconta o estoque quando existe e exporta.
 */

import { shoppingListTable, type ExportFormat } from '@adatechnology/recipe-contracts'
import { Download, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { useShoppingList } from '../hooks/useShoppingList'
import { formatCents, formatMoney, formatQuantity } from '../lib/format'
import { buildSpreadsheetBlob, downloadBlob } from '../lib/spreadsheetDownload'
import { useRecipesApi, useRecipesText } from '../providers/RecipesProvider'
import type { PlannedItemsSource, ProductOption } from '../providers/types'
import { Field } from './Field'
import { SelectField } from './SelectField'

export type ShoppingListWorkspaceProps = {
  readonly products: readonly ProductOption[]
  readonly plannedItemsSources?: readonly PlannedItemsSource[]
}

export function ShoppingListWorkspace({ products, plannedItemsSources = [] }: ShoppingListWorkspaceProps) {
  const api = useRecipesApi()
  const { messages, locale, currency, format } = useRecipesText()
  const shopping = useShoppingList()
  const productName = new Map(products.map((product) => [product.id, product.name]))
  const productOptions = products.map((product) => ({ id: product.id, label: product.name }))
  const { list } = shopping
  const [exportError, setExportError] = useState(false)

  async function handleExport(exportFormat: ExportFormat): Promise<void> {
    if (!list) return
    setExportError(false)
    try {
      await download(exportFormat)
    } catch {
      setExportError(true)
    }
  }

  async function download(exportFormat: ExportFormat): Promise<void> {
    if (!list) return
    const fileName = `lista-de-compras.${exportFormat}`
    if (api.exportShoppingList) {
      downloadBlob(await api.exportShoppingList(shopping.plannedItems(), exportFormat), fileName)
      return
    }
    downloadBlob(buildSpreadsheetBlob(shoppingListTable(list), exportFormat), fileName)
  }

  return (
    <section className="arc-root arc-workspace" aria-labelledby="arc-shopping-title" lang={locale}>
      <h1 className="arc-title" id="arc-shopping-title">
        {messages.shoppingTitle}
      </h1>
      <p className="arc-hint">{messages.shoppingIntro}</p>
      {plannedItemsSources.length > 0 ? (
        <div className="arc-toolbar-actions">
          {plannedItemsSources.map((source) => (
            <button key={source.id} type="button" className="arc-button arc-button--ghost" onClick={() => void source.load().then(shopping.replaceRows)}>
              {source.label}
            </button>
          ))}
        </div>
      ) : null}
      <ol className="arc-lines">
        {shopping.rows.map((row) => (
          <li key={row.key} className="arc-line arc-grid">
            <SelectField id={`arc-planned-${row.key}-product`} label={messages.plannedProduct} value={row.productId} options={productOptions} onChange={(productId) => shopping.updateRow(row.key, { productId })} />
            <Field id={`arc-planned-${row.key}-quantity`} label={messages.plannedQuantity}>
              {(aria) => (
                <input id={`arc-planned-${row.key}-quantity`} className="arc-input arc-number-input" inputMode="decimal" value={row.quantity} onChange={(event) => shopping.updateRow(row.key, { quantity: event.target.value })} {...aria} />
              )}
            </Field>
            <button type="button" className="arc-icon-button arc-icon-button--danger arc-line-remove" aria-label={messages.removePlannedItem} title={messages.removePlannedItem} onClick={() => shopping.removeRow(row.key)}>
              <Trash2 aria-hidden="true" className="arc-icon" />
            </button>
          </li>
        ))}
      </ol>
      <div className="arc-form-actions">
        <button type="button" className="arc-button arc-button--ghost" onClick={() => shopping.addRow()}>
          <Plus aria-hidden="true" className="arc-icon" />
          <span>{messages.addPlannedItem}</span>
        </button>
        <button type="button" className="arc-button" disabled={shopping.isBuilding} onClick={() => void shopping.build()}>
          {shopping.isBuilding ? messages.building : messages.buildList}
        </button>
      </div>
      <p className={`arc-status${shopping.error ? ' arc-status--error' : ''}`} role="status" aria-live="polite">
        {shopping.error ?? ''}
      </p>
      {list ? (
        <section className="arc-section" aria-label={messages.shoppingTitle}>
          {!list.hasStockData ? <p className="arc-hint">{messages.withoutStockNotice}</p> : null}
          {list.productsWithoutRecipe.length > 0 ? (
            <p className="arc-error">
              {format('productsWithoutRecipe', { products: list.productsWithoutRecipe.map((id) => productName.get(id) ?? id).join(', ') })}
            </p>
          ) : null}
          {list.rows.length === 0 ? (
            <p className="arc-empty">{messages.emptyShopping}</p>
          ) : (
            <div className="arc-table-wrap">
              <table className="arc-table arc-table--cards">
                <thead>
                  <tr>
                    <th scope="col">{messages.columnName}</th>
                    <th scope="col">{messages.columnGross}</th>
                    {list.hasStockData ? <th scope="col">{messages.columnStock}</th> : null}
                    <th scope="col">{messages.columnNet}</th>
                    <th scope="col">{messages.columnEstimatedCost}</th>
                    <th scope="col">{messages.columnSupplier}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((row) => {
                    const unit = messages[`unit_${row.unit}`]
                    return (
                      <tr key={row.ingredientId}>
                        <td data-label={messages.columnName}>{row.name}</td>
                        <td data-label={messages.columnGross} className="arc-number">{`${formatQuantity({ value: row.grossQuantity, locale })} ${unit}`}</td>
                        {list.hasStockData ? (
                          <td data-label={messages.columnStock} className="arc-number">{`${formatQuantity({ value: row.stockQuantity ?? '0', locale })} ${unit}`}</td>
                        ) : null}
                        <td data-label={messages.columnNet} className="arc-number">
                          <strong>{`${formatQuantity({ value: row.netQuantity, locale })} ${unit}`}</strong>
                        </td>
                        <td data-label={messages.columnEstimatedCost} className="arc-number">{formatMoney({ value: row.estimatedCost, locale, currency })}</td>
                        <td data-label={messages.columnSupplier}>{row.supplier ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="arc-form-actions">
            <strong>{`${messages.estimatedTotal}: ${formatCents({ cents: list.totalEstimatedCostCents, locale, currency })}`}</strong>
            <button type="button" className="arc-button arc-button--ghost" onClick={() => void handleExport('csv')}>
              <Download aria-hidden="true" className="arc-icon" />
              <span>{messages.exportCsv}</span>
            </button>
            <button type="button" className="arc-button arc-button--ghost" onClick={() => void handleExport('xlsx')}>
              <Download aria-hidden="true" className="arc-icon" />
              <span>{messages.exportXlsx}</span>
            </button>
          </div>
          {exportError ? (
            <p className="arc-error" role="alert">
              {messages.exportError}
            </p>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}
