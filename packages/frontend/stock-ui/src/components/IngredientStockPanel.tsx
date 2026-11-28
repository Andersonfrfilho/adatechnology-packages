/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Tudo do estoque de um insumo: saldo, mínimo, registrar entrada/ajuste/perda, lotes e movimentos.
 */

import { Feedback, Field, formatQuantity, fromInputDecimal, toInputDecimal, useAsyncResource, useRecipesText } from '@adatechnology/recipes-ui'
import type { StockLevelView } from '@adatechnology/stock-contracts'
import { useEffect, useState } from 'react'

import { useStockApi, useStockText } from '../providers/StockProvider'
import { BatchesTable, MovementsTable } from './StockHistory'
import { StockMovementForm } from './StockMovementForm'

const HISTORY_SIZE = 10

export type IngredientStockPanelProps = { readonly ingredientId: string; readonly onChanged?: () => void }

export function IngredientStockPanel({ ingredientId, onChanged }: IngredientStockPanelProps) {
  const api = useStockApi()
  const { messages } = useStockText()
  const { locale, messages: recipeMessages } = useRecipesText()
  const level = useAsyncResource(() => api.getLevel(ingredientId), ingredientId)
  const batches = useAsyncResource(() => api.listBatches({ ingredientId, page: 1, pageSize: 50 }), `${ingredientId}:${level.data?.updatedAt}`)
  const movements = useAsyncResource(() => api.listMovements({ ingredientId, page: 1, pageSize: HISTORY_SIZE }), `${ingredientId}:${level.data?.updatedAt}`)
  const [minimum, setMinimum] = useState('')
  const [minimumError, setMinimumError] = useState<string>()
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string }>()

  useEffect(() => {
    if (level.data) setMinimum(level.data.minimumQuantity === null ? '' : toInputDecimal({ value: level.data.minimumQuantity, locale }))
  }, [level.data, locale])

  if (level.error)
    return (
      <div className="arc-empty" role="alert">
        <p>{messages.loadError}</p>
        <button type="button" className="arc-button arc-button--ghost" onClick={level.reload}>
          {messages.retry}
        </button>
      </div>
    )
  if (!level.data) return <p className="arc-empty">{messages.loading}</p>
  const current: StockLevelView = level.data
  const unit = recipeMessages[`unit_${current.unit}`]

  async function saveMinimum(): Promise<void> {
    const value = minimum.trim() ? fromInputDecimal(minimum) : null
    if (value === undefined) {
      setMinimumError(messages.invalidDecimal)
      return
    }
    setMinimumError(undefined)
    try {
      await api.setMinimum?.(ingredientId, value)
      level.reload()
      onChanged?.()
      setFeedback({ kind: 'success', message: messages.savedMinimum })
    } catch {
      setFeedback({ kind: 'error', message: messages.genericError })
    }
  }

  return (
    <div className="arc-editor">
      <div className="arc-report">
        <div className={`arc-report-card${current.isBelowMinimum || current.quantity.startsWith('-') ? ' arc-report-card--danger' : ''}`}>
          <span>{messages.currentBalance}</span>
          <strong>{`${formatQuantity({ value: current.quantity, locale })} ${unit}`}</strong>
        </div>
      </div>
      {api.setMinimum ? (
        <div className="arc-grid">
          <Field id={`ast-minimum-${ingredientId}`} label={`${messages.minimumLabel} (${unit})`} hint={messages.minimumHint} {...(minimumError ? { error: minimumError } : {})}>
            {(aria) => <input id={`ast-minimum-${ingredientId}`} className="arc-input arc-number-input" inputMode="decimal" value={minimum} onChange={(event) => setMinimum(event.target.value)} {...aria} />}
          </Field>
          <div className="arc-form-actions">
            <button type="button" className="arc-button arc-button--ghost" onClick={() => void saveMinimum()}>
              {messages.saveMinimum}
            </button>
          </div>
        </div>
      ) : null}
      <Feedback feedback={feedback} />
      <StockMovementForm
        level={current}
        batches={batches.data?.data ?? []}
        onRecorded={() => {
          level.reload()
          onChanged?.()
        }}
      />
      <BatchesTable batches={batches.data?.data ?? []} />
      <MovementsTable movements={movements.data?.data ?? []} />
    </div>
  )
}
