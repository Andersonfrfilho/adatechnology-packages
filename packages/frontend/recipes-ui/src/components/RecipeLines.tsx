/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { compatibleUnits, type RecipeCost } from '@adatechnology/recipe-contracts'
import { Trash2 } from 'lucide-react'

import type { RecipeEditor } from '../hooks/useRecipeEditor'
import { formatMoney } from '../lib/format'
import { useRecipesText } from '../providers/RecipesProvider'
import { Field } from './Field'
import { SelectField } from './SelectField'

export type RecipeLinesProps = {
  readonly editor: RecipeEditor
  readonly cost: RecipeCost
  readonly isReadOnly: boolean
}

/** Uma linha por insumo: quantidade, unidade (só as que convertem), observação e custo ao vivo. */
export function RecipeLines({ editor, cost, isReadOnly }: RecipeLinesProps) {
  const { messages, locale, currency, format } = useRecipesText()
  const costByLine = new Map(cost.lines.map((line) => [line.lineId, line]))
  if (editor.draft.lines.length === 0) return <p className="arc-empty">{messages.noLines}</p>
  return (
    <ol className="arc-lines">
      {editor.draft.lines.map((line, index) => {
        const ingredient = editor.ingredients.get(line.ingredientId)
        const lineCost = costByLine.get(line.key)
        const quantityError = editor.errors[`lines.${index}.quantity`]
        const unitError = editor.errors[`lines.${index}.unit`]
        const units = ingredient ? compatibleUnits(ingredient.unit) : [line.unit]
        return (
          <li key={line.key} className="arc-line" data-field={`lines.${index}`}>
            <div className="arc-line-head">
              <strong className="arc-truncate" title={ingredient?.name}>
                {ingredient?.name ?? messages.missingIngredient}
              </strong>
              <span className="arc-number">{lineCost ? formatMoney({ value: lineCost.cost, locale, currency }) : '—'}</span>
              {!isReadOnly ? (
                <button type="button" className="arc-icon-button arc-icon-button--danger" aria-label={messages.removeLine} title={messages.removeLine} onClick={() => editor.removeLine(line.key)}>
                  <Trash2 aria-hidden="true" className="arc-icon" />
                </button>
              ) : null}
            </div>
            <div className="arc-grid">
              <Field id={`arc-line-${line.key}-quantity`} label={messages.lineQuantity} {...(quantityError ? { error: quantityError } : {})}>
                {(aria) => (
                  <input
                    id={`arc-line-${line.key}-quantity`}
                    className="arc-input arc-number-input"
                    inputMode="decimal"
                    readOnly={isReadOnly}
                    value={line.quantity}
                    onChange={(event) => editor.updateLine(line.key, { quantity: event.target.value })}
                    {...aria}
                  />
                )}
              </Field>
              <div>
                <SelectField
                  id={`arc-line-${line.key}-unit`}
                  label={messages.lineUnit}
                  value={line.unit}
                  options={units.map((unit) => ({ id: unit, label: messages[`unit_${unit}`] }))}
                  onChange={(value) => !isReadOnly && editor.updateLine(line.key, { unit: value as typeof line.unit })}
                />
                {unitError ? (
                  <p className="arc-error" role="alert">
                    {unitError}
                  </p>
                ) : null}
              </div>
              <Field id={`arc-line-${line.key}-notes`} label={messages.lineNotes}>
                {(aria) => (
                  <input
                    id={`arc-line-${line.key}-notes`}
                    className="arc-input"
                    maxLength={500}
                    readOnly={isReadOnly}
                    value={line.notes}
                    onChange={(event) => editor.updateLine(line.key, { notes: event.target.value })}
                    {...aria}
                  />
                )}
              </Field>
            </div>
            {ingredient && line.unit !== ingredient.unit && lineCost ? (
              <p className="arc-hint">
                {format('lineConverted', { quantity: lineCost.quantityInIngredientUnit.replace(/\.?0+$/, ''), unit: messages[`unit_${ingredient.unit}`] })}
              </p>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
