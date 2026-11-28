/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Inventário: abre (um por vez), conta em várias idas, aplica ou cancela com confirmação.
 */

import { ConfirmDialog, Feedback, Field, formatDateTime, formatQuantity, fromInputDecimal, readErrorCode, toInputDecimal, useAsyncResource, useRecipesText } from '@adatechnology/recipes-ui'
import { STOCK_ERROR_CODES, type InventoryCount } from '@adatechnology/stock-contracts'
import { useEffect, useState } from 'react'

import { useStockApi, useStockText } from '../providers/StockProvider'

type Pending = 'apply' | 'cancel' | undefined

function OpenInventory({ inventory, onChanged }: { readonly inventory: InventoryCount; readonly onChanged: (message: string) => void }) {
  const api = useStockApi()
  const { messages, format } = useStockText()
  const { locale, messages: recipeMessages } = useRecipesText()
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<Pending>()
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string }>()

  useEffect(() => {
    setCounts(Object.fromEntries(inventory.lines.map((line) => [line.ingredientId, line.countedQuantity === null ? '' : toInputDecimal({ value: line.countedQuantity, locale })])))
  }, [inventory, locale])

  async function saveCounts(): Promise<boolean> {
    const next: Record<string, string> = {}
    const entries = inventory.lines.map((line) => {
      const text = counts[line.ingredientId]?.trim() ?? ''
      const value = text ? fromInputDecimal(text) : null
      if (value === undefined) next[line.ingredientId] = messages.invalidDecimal
      return { ingredientId: line.ingredientId, countedQuantity: value ?? null }
    })
    setErrors(next)
    if (Object.keys(next).length > 0 || !api.recordCounts) return false
    try {
      await api.recordCounts(inventory.id, entries)
      setFeedback({ kind: 'success', message: messages.savedCounts })
      return true
    } catch {
      setFeedback({ kind: 'error', message: messages.genericError })
      return false
    }
  }

  async function confirm(action: Exclude<Pending, undefined>): Promise<void> {
    setPending(undefined)
    try {
      if (action === 'apply') {
        if (!(await saveCounts())) return
        await api.applyInventory?.(inventory.id)
        onChanged(messages.applied)
      } else {
        await api.cancelInventory?.(inventory.id)
        onChanged(messages.cancelled)
      }
    } catch {
      setFeedback({ kind: 'error', message: messages.genericError })
    }
  }

  const counted = inventory.lines.filter((line) => counts[line.ingredientId]?.trim()).length
  return (
    <section className="arc-section" aria-label={messages.inventoryTitle}>
      <p className="arc-hint">{messages.inventoryOpenHint}</p>
      <p className="arc-total">{format('countedOf', { counted, total: inventory.lines.length })}</p>
      <ol className="arc-lines">
        {inventory.lines.map((line) => {
          const unit = recipeMessages[`unit_${line.unit}`]
          const error = errors[line.ingredientId]
          return (
            <li key={line.ingredientId} className="arc-line arc-grid">
              <div>
                <strong>{line.ingredientName ?? line.ingredientId}</strong>
                <p className="arc-hint">{`${messages.columnExpected}: ${formatQuantity({ value: line.expectedQuantity, locale })} ${unit}`}</p>
              </div>
              <Field id={`ast-count-${line.ingredientId}`} label={`${messages.columnCounted} (${unit})`} {...(error ? { error } : {})}>
                {(aria) => (
                  <input
                    id={`ast-count-${line.ingredientId}`}
                    className="arc-input arc-number-input"
                    inputMode="decimal"
                    value={counts[line.ingredientId] ?? ''}
                    onChange={(event) => setCounts((current) => ({ ...current, [line.ingredientId]: event.target.value }))}
                    {...aria}
                  />
                )}
              </Field>
            </li>
          )
        })}
      </ol>
      <Feedback feedback={feedback} />
      <div className="arc-form-actions">
        {api.cancelInventory ? (
          <button type="button" className="arc-button arc-button--danger" onClick={() => setPending('cancel')}>
            {messages.cancelInventory}
          </button>
        ) : null}
        {api.recordCounts ? (
          <button type="button" className="arc-button arc-button--ghost" onClick={() => void saveCounts()}>
            {messages.saveCounts}
          </button>
        ) : null}
        {api.applyInventory ? (
          <button type="button" className="arc-button" onClick={() => setPending('apply')}>
            {messages.applyInventory}
          </button>
        ) : null}
      </div>
      {pending ? (
        <ConfirmDialog
          message={pending === 'apply' ? messages.applyConfirm : messages.cancelConfirm}
          confirmLabel={pending === 'apply' ? messages.applyInventory : messages.cancelInventory}
          isDanger={pending === 'cancel'}
          onConfirm={() => void confirm(pending)}
          onCancel={() => setPending(undefined)}
        />
      ) : null}
    </section>
  )
}

export function InventoryWorkspace() {
  const api = useStockApi()
  const { messages } = useStockText()
  const { locale } = useRecipesText()
  const [version, setVersion] = useState(0)
  const [note, setNote] = useState('')
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string }>()
  const list = useAsyncResource(() => api.listInventories?.({ page: 1, pageSize: 20 }) ?? Promise.resolve(undefined), String(version))
  const openSummary = list.data?.data.find((item) => item.status === 'open')
  const open = useAsyncResource(() => (openSummary && api.getInventory ? api.getInventory(openSummary.id) : Promise.resolve(undefined)), `${openSummary?.id}:${version}`)

  async function handleOpen(): Promise<void> {
    try {
      await api.openInventory?.({ note: note.trim() })
      setNote('')
      setVersion((value) => value + 1)
    } catch (error) {
      setFeedback({ kind: 'error', message: readErrorCode(error) === STOCK_ERROR_CODES.INVENTORY_ALREADY_OPEN ? messages.alreadyOpen : messages.genericError })
    }
  }

  if (!api.listInventories) return null
  return (
    <section className="arc-root arc-workspace" aria-labelledby="ast-inventory-title">
      <h1 className="arc-title" id="ast-inventory-title">
        {messages.inventoryTitle}
      </h1>
      {open.data ? (
        <OpenInventory
          inventory={open.data}
          onChanged={(message) => {
            setFeedback({ kind: 'success', message })
            setVersion((value) => value + 1)
          }}
        />
      ) : api.openInventory ? (
        <div className="arc-grid">
          <Field id="ast-inventory-note" label={messages.inventoryNote}>
            {(aria) => <input id="ast-inventory-note" className="arc-input" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} {...aria} />}
          </Field>
          <div className="arc-form-actions">
            <button type="button" className="arc-button" onClick={() => void handleOpen()}>
              {messages.openInventory}
            </button>
          </div>
        </div>
      ) : null}
      <Feedback feedback={feedback} />
      {(list.data?.data.length ?? 0) === 0 ? (
        <p className="arc-empty">{list.isLoading ? messages.loading : messages.noInventories}</p>
      ) : (
        <div className="arc-table-wrap">
          <table className="arc-table arc-table--cards">
            <thead>
              <tr>
                <th scope="col">{messages.columnWhen}</th>
                <th scope="col">{messages.columnStatus}</th>
                <th scope="col">{messages.inventoryNote}</th>
                <th scope="col">{messages.columnCounted}</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.data.map((item) => (
                <tr key={item.id}>
                  <td data-label={messages.columnWhen}>{formatDateTime({ value: item.createdAt, locale })}</td>
                  <td data-label={messages.columnStatus}>
                    <span className={`arc-chip ast-inventory ast-inventory--${item.status}`}>{messages[`inventoryStatus_${item.status}`]}</span>
                  </td>
                  <td data-label={messages.inventoryNote}>{item.note || '—'}</td>
                  <td data-label={messages.columnCounted}>{`${item.countedCount}/${item.lineCount}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
