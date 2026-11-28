/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { isPositive, parseDecimal, type ShoppingList } from '@adatechnology/recipe-contracts'
import { useState } from 'react'

import { fromInputDecimal } from '../lib/format'
import { useRecipesApi, useRecipesText } from '../providers/RecipesProvider'
import type { PlannedItemInput } from '../providers/types'

export type PlannedRow = { readonly key: string; readonly productId: string; readonly quantity: string }

export type ShoppingListState = {
  readonly rows: readonly PlannedRow[]
  readonly list: ShoppingList | undefined
  readonly isBuilding: boolean
  readonly error: string | undefined
  readonly addRow: (row?: Partial<Omit<PlannedRow, 'key'>>) => void
  readonly updateRow: (key: string, patch: Partial<Omit<PlannedRow, 'key'>>) => void
  readonly removeRow: (key: string) => void
  readonly replaceRows: (items: readonly PlannedItemInput[]) => void
  readonly plannedItems: () => PlannedItemInput[]
  readonly build: () => Promise<void>
}

let rowSequence = 0
function nextKey(): string {
  rowSequence += 1
  return `planned-${rowSequence}`
}

export function useShoppingList(): ShoppingListState {
  const api = useRecipesApi()
  const { messages } = useRecipesText()
  const [rows, setRows] = useState<readonly PlannedRow[]>([{ key: nextKey(), productId: '', quantity: '' }])
  const [list, setList] = useState<ShoppingList>()
  const [isBuilding, setIsBuilding] = useState(false)
  const [error, setError] = useState<string>()

  function plannedItems(): PlannedItemInput[] {
    return rows.flatMap((row) => {
      const quantity = fromInputDecimal(row.quantity)
      if (!row.productId || !quantity || !isPositive(parseDecimal(quantity))) return []
      return [{ productId: row.productId, quantity }]
    })
  }

  async function build(): Promise<void> {
    if (!api.buildShoppingList) return
    const items = plannedItems()
    if (items.length === 0) {
      setError(messages.noPlannedItems)
      return
    }
    setError(undefined)
    setIsBuilding(true)
    try {
      setList(await api.buildShoppingList(items))
    } catch {
      setError(messages.genericError)
    } finally {
      setIsBuilding(false)
    }
  }

  return {
    rows,
    list,
    isBuilding,
    error,
    addRow: (row = {}) => setRows((current) => [...current, { key: nextKey(), productId: '', quantity: '', ...row }]),
    updateRow: (key, patch) =>
      setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row))),
    removeRow: (key) => setRows((current) => current.filter((row) => row.key !== key)),
    replaceRows: (items) =>
      setRows(
        items.map((item) => ({
          key: nextKey(),
          productId: item.productId,
          quantity: item.quantity.replace(/\.?0+$/, ''),
        })),
      ),
    plannedItems,
    build,
  }
}
