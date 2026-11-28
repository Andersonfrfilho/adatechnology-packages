/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Entrada (lote, custo, validade), ajuste (direção) e perda (lote ou os que vencem antes), todos
 * com motivo; a quantidade é digitada na unidade do insumo.
 */

import { Field, Feedback, fromInputDecimal, readErrorCode, SelectField } from '@adatechnology/recipes-ui'
import { STOCK_ERROR_CODES, type StockBatch, type StockLevelView } from '@adatechnology/stock-contracts'
import { useState, type FormEvent } from 'react'

import { maskDate, parseDateInput } from '../lib/date'
import { useStockApi, useStockText } from '../providers/StockProvider'

type Mode = 'receive' | 'adjust' | 'loss'
type Form = { quantity: string; batchCode: string; cost: string; expiresAt: string; reason: string; direction: 'increase' | 'decrease'; batchId: string }

const EMPTY_FORM: Form = { quantity: '', batchCode: '', cost: '', expiresAt: '', reason: '', direction: 'increase', batchId: '' }

export type StockMovementFormProps = {
  readonly level: StockLevelView
  readonly batches: readonly StockBatch[]
  readonly onRecorded: (level: StockLevelView) => void
}

export function StockMovementForm({ level, batches, onRecorded }: StockMovementFormProps) {
  const api = useStockApi()
  const { messages } = useStockText()
  const modes = [
    ...(api.receiveBatch ? [{ id: 'receive', label: messages.tabReceive }] : []),
    ...(api.adjustStock ? [{ id: 'adjust', label: messages.tabAdjust }] : []),
    ...(api.recordLoss ? [{ id: 'loss', label: messages.tabLoss }] : []),
  ]
  const [mode, setMode] = useState<Mode>((modes[0]?.id as Mode | undefined) ?? 'receive')
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string }>()
  if (modes.length === 0) return null

  function change(field: keyof Form, value: string): void {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function validate(): Partial<Record<keyof Form, string>> {
    const next: Partial<Record<keyof Form, string>> = {}
    if (!fromInputDecimal(form.quantity)) next.quantity = messages.invalidDecimal
    if (mode === 'receive' && !form.batchCode.trim()) next.batchCode = messages.requiredField
    if (mode === 'receive' && form.cost.trim() && !fromInputDecimal(form.cost)) next.cost = messages.invalidDecimal
    if (mode === 'receive' && form.expiresAt.trim() && !parseDateInput(form.expiresAt)) next.expiresAt = messages.invalidDate
    if (mode !== 'receive' && !form.reason.trim()) next.reason = messages.requiredField
    return next
  }

  async function submit(): Promise<StockLevelView | undefined> {
    const quantity = fromInputDecimal(form.quantity) ?? '0'
    const ingredientId = level.ingredientId
    if (mode === 'receive') {
      const expiresAt = form.expiresAt.trim() ? parseDateInput(form.expiresAt) : undefined
      return api.receiveBatch?.({
        ingredientId,
        quantity,
        batchCode: form.batchCode.trim(),
        costPerUnit: form.cost.trim() ? (fromInputDecimal(form.cost) ?? null) : null,
        expiresAt: expiresAt ?? null,
        ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
      })
    }
    if (mode === 'adjust') return api.adjustStock?.({ ingredientId, quantity, direction: form.direction, reason: form.reason.trim() })
    return api.recordLoss?.({ ingredientId, quantity, reason: form.reason.trim(), ...(form.batchId ? { batchId: form.batchId } : {}) })
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return
    try {
      const updated = await submit()
      if (updated) onRecorded(updated)
      setForm(EMPTY_FORM)
      setFeedback({ kind: 'success', message: messages.registered })
    } catch (error) {
      const insufficient = readErrorCode(error) === STOCK_ERROR_CODES.INSUFFICIENT_BATCH
      setFeedback({ kind: 'error', message: insufficient ? messages.insufficientBatch : messages.genericError })
    }
  }

  const fieldError = (field: keyof Form) => (errors[field] ? { error: errors[field] as string } : {})
  return (
    <form className="arc-section" onSubmit={handleSubmit}>
      <SelectField id={`ast-mode-${level.ingredientId}`} label={messages.movementMode} value={mode} options={modes} onChange={(value) => setMode(value as Mode)} />
      <div className="arc-grid">
        <Field id="ast-quantity" label={messages.quantity} {...fieldError('quantity')}>
          {(aria) => <input id="ast-quantity" className="arc-input arc-number-input" inputMode="decimal" value={form.quantity} onChange={(event) => change('quantity', event.target.value)} {...aria} />}
        </Field>
        {mode === 'receive' ? (
          <>
            <Field id="ast-batch-code" label={messages.batchCode} {...fieldError('batchCode')}>
              {(aria) => <input id="ast-batch-code" className="arc-input" maxLength={100} value={form.batchCode} onChange={(event) => change('batchCode', event.target.value)} {...aria} />}
            </Field>
            <Field id="ast-cost" label={messages.costPerUnit} {...fieldError('cost')}>
              {(aria) => <input id="ast-cost" className="arc-input arc-number-input" inputMode="decimal" value={form.cost} onChange={(event) => change('cost', event.target.value)} {...aria} />}
            </Field>
            <Field id="ast-expires" label={messages.expiresAt} {...fieldError('expiresAt')}>
              {(aria) => <input id="ast-expires" className="arc-input" inputMode="numeric" placeholder="dd/mm/aaaa" value={form.expiresAt} onChange={(event) => change('expiresAt', maskDate(event.target.value))} {...aria} />}
            </Field>
          </>
        ) : null}
        {mode === 'adjust' ? (
          <SelectField
            id="ast-direction"
            label={messages.direction}
            value={form.direction}
            options={[
              { id: 'increase', label: messages.increase },
              { id: 'decrease', label: messages.decrease },
            ]}
            onChange={(value) => change('direction', value)}
          />
        ) : null}
        {mode === 'loss' ? (
          <SelectField
            id="ast-loss-batch"
            label={messages.lossBatch}
            value={form.batchId}
            options={[{ id: '', label: messages.anyBatch }, ...batches.map((batch) => ({ id: batch.id, label: batch.batchCode }))]}
            onChange={(value) => change('batchId', value)}
          />
        ) : null}
        <Field id="ast-reason" label={messages.reason} {...fieldError('reason')}>
          {(aria) => <input id="ast-reason" className="arc-input" maxLength={255} value={form.reason} onChange={(event) => change('reason', event.target.value)} {...aria} />}
        </Field>
      </div>
      <Feedback feedback={feedback} />
      <div className="arc-form-actions">
        <button type="submit" className="arc-button">
          {messages.register}
        </button>
      </div>
    </form>
  )
}
