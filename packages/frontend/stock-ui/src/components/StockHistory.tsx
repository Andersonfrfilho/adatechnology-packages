/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { formatDateTime, formatQuantity, useRecipesText } from '@adatechnology/recipes-ui'
import type { StockBatch, StockMovement } from '@adatechnology/stock-contracts'

import { formatDate } from '../lib/date'
import { useStockText } from '../providers/StockProvider'

const DAY_MS = 86_400_000
const SOON_DAYS = 7

function expiryState(expiresAt: string | null, now: number): 'expired' | 'soon' | undefined {
  if (!expiresAt) return undefined
  const time = new Date(expiresAt).getTime()
  if (time < now) return 'expired'
  return time - now <= SOON_DAYS * DAY_MS ? 'soon' : undefined
}

export function BatchesTable({ batches, now = Date.now() }: { readonly batches: readonly StockBatch[]; readonly now?: number }) {
  const { messages } = useStockText()
  const { locale, messages: recipeMessages } = useRecipesText()
  if (batches.length === 0) return <p className="arc-empty">{messages.noBatches}</p>
  return (
    <div className="arc-table-wrap">
      <table className="arc-table arc-table--cards">
        <caption className="arc-subtitle">{messages.batchesTitle}</caption>
        <thead>
          <tr>
            <th scope="col">{messages.columnBatch}</th>
            <th scope="col">{messages.columnRemaining}</th>
            <th scope="col">{messages.columnExpiresAt}</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => {
            const state = expiryState(batch.expiresAt, now)
            return (
              <tr key={batch.id}>
                <td data-label={messages.columnBatch}>{batch.batchCode}</td>
                <td data-label={messages.columnRemaining} className="arc-number">{`${formatQuantity({ value: batch.remainingQuantity, locale })} ${recipeMessages[`unit_${batch.unit}`]}`}</td>
                <td data-label={messages.columnExpiresAt}>
                  {batch.expiresAt ? formatDate({ value: batch.expiresAt, locale }) : messages.noExpiry}{' '}
                  {state ? <span className={`arc-chip ast-status ast-status--${state === 'expired' ? 'negative' : 'below'}`}>{state === 'expired' ? messages.expired : messages.expiringSoon}</span> : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function MovementsTable({ movements }: { readonly movements: readonly StockMovement[] }) {
  const { messages } = useStockText()
  const { locale, messages: recipeMessages } = useRecipesText()
  if (movements.length === 0) return <p className="arc-empty">{messages.noMovements}</p>
  return (
    <div className="arc-table-wrap">
      <table className="arc-table arc-table--cards">
        <caption className="arc-subtitle">{messages.movementsTitle}</caption>
        <thead>
          <tr>
            <th scope="col">{messages.columnKind}</th>
            <th scope="col">{messages.columnDelta}</th>
            <th scope="col">{messages.columnReason}</th>
            <th scope="col">{messages.columnWhen}</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td data-label={messages.columnKind}>
                <span className={`arc-chip ast-kind ast-kind--${movement.kind}`}>{messages[`kind_${movement.kind}`]}</span>
              </td>
              <td data-label={messages.columnDelta} className="arc-number">{`${movement.delta.startsWith('-') ? '' : '+'}${formatQuantity({ value: movement.delta, locale })} ${recipeMessages[`unit_${movement.unit}`]}`}</td>
              <td data-label={messages.columnReason}>{movement.reason}</td>
              <td data-label={messages.columnWhen}>{formatDateTime({ value: movement.createdAt, locale })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
