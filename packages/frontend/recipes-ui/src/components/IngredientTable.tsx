/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Ingredient, IngredientSortField } from '@adatechnology/recipe-contracts'
import { Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { formatDateTime, formatMoney } from '../lib/format'
import { useRecipesText } from '../providers/RecipesProvider'
import type { SortOrder } from '../providers/types'
import { SortHeader } from './SortHeader'

export type IngredientTableProps = {
  readonly rows: readonly Ingredient[]
  readonly sort: IngredientSortField
  readonly order: SortOrder
  readonly onToggleSort: (field: IngredientSortField) => void
  readonly onEdit?: (ingredient: Ingredient) => void
  readonly onRemove?: (ingredient: Ingredient) => void
  /** Ações do host na linha (ex.: estoque do insumo). */
  readonly renderRowActions?: (ingredient: Ingredient) => ReactNode
}

/** Tabela zebrada; no celular cada linha vira cartão com os mesmos dados (rótulo por `data-label`). */
export function IngredientTable(props: IngredientTableProps) {
  const { messages, locale, currency } = useRecipesText()
  const header = (field: IngredientSortField, label: string) => (
    <SortHeader label={label} direction={props.sort === field ? props.order : undefined} onToggle={() => props.onToggleSort(field)} />
  )
  const hasActions = Boolean(props.onEdit || props.onRemove || props.renderRowActions)
  return (
    <div className="arc-table-wrap">
      <table className="arc-table arc-table--cards">
        <thead>
          <tr>
            {header('name', messages.columnName)}
            {header('unit', messages.columnUnit)}
            {header('costPerUnit', messages.columnCostPerUnit)}
            <th scope="col">{messages.columnSupplier}</th>
            {header('updatedAt', messages.columnUpdatedAt)}
            {hasActions ? <th scope="col">{messages.columnActions}</th> : null}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((ingredient) => (
            <tr key={ingredient.id}>
              <td data-label={messages.columnName}>
                <span className="arc-truncate" title={ingredient.name}>
                  {ingredient.name}
                </span>
              </td>
              <td data-label={messages.columnUnit}>
                <span className="arc-chip">{messages[`unit_${ingredient.unit}`]}</span>
              </td>
              <td data-label={messages.columnCostPerUnit} className="arc-number">
                {formatMoney({ value: ingredient.costPerUnit, locale, currency })}
              </td>
              <td data-label={messages.columnSupplier}>{ingredient.supplier ?? '—'}</td>
              <td data-label={messages.columnUpdatedAt}>{formatDateTime({ value: ingredient.updatedAt, locale })}</td>
              {hasActions ? (
                <td data-label={messages.columnActions}>
                  <div className="arc-row-actions">
                    {props.renderRowActions?.(ingredient)}
                    {props.onEdit ? (
                      <button type="button" className="arc-icon-button" aria-label={messages.edit} title={messages.edit} onClick={() => props.onEdit?.(ingredient)}>
                        <Pencil aria-hidden="true" className="arc-icon" />
                      </button>
                    ) : null}
                    {props.onRemove ? (
                      <button type="button" className="arc-icon-button arc-icon-button--danger" aria-label={messages.remove} title={messages.remove} onClick={() => props.onRemove?.(ingredient)}>
                        <Trash2 aria-hidden="true" className="arc-icon" />
                      </button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
