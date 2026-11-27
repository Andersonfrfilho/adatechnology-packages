/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { RecipeCost } from '@adatechnology/recipe-contracts'

import { formatBasisPoints, formatCents, formatMoney } from '../lib/format'
import { useRecipesText } from '../providers/RecipesProvider'

export type RecipeCostSummaryProps = { readonly cost: RecipeCost }

/** Custo da receita, por porção, preço e margem; margem negativa em destaque. */
export function RecipeCostSummary({ cost }: RecipeCostSummaryProps) {
  const { messages, locale, currency, format } = useRecipesText()
  const isNegative = (cost.marginCents ?? 0) < 0
  return (
    <section className="arc-report" aria-label={messages.costTitle}>
      <div className="arc-report-card">
        <span>{messages.totalCost}</span>
        <strong>{formatMoney({ value: cost.totalCost, locale, currency })}</strong>
      </div>
      <div className="arc-report-card">
        <span>{messages.costPerPortion}</span>
        <strong>{formatMoney({ value: cost.costPerPortion, locale, currency })}</strong>
      </div>
      {cost.salePriceCents !== null && cost.marginBasisPoints !== null ? (
        <>
          <div className="arc-report-card">
            <span>{messages.salePrice}</span>
            <strong>{formatCents({ cents: cost.salePriceCents, locale, currency })}</strong>
          </div>
          <div className={`arc-report-card${isNegative ? ' arc-report-card--danger' : ''}`}>
            <span>{messages.margin}</span>
            <strong>
              {formatCents({ cents: cost.marginCents ?? 0, locale, currency })} ·{' '}
              {formatBasisPoints({ basisPoints: cost.marginBasisPoints, locale })}
            </strong>
          </div>
        </>
      ) : (
        <p className="arc-hint">{messages.marginUnavailable}</p>
      )}
      {cost.missingIngredientIds.length > 0 ? (
        <p className="arc-error" role="alert">
          {format('missingIngredientsWarning', { count: cost.missingIngredientIds.length })}
        </p>
      ) : null}
    </section>
  )
}
