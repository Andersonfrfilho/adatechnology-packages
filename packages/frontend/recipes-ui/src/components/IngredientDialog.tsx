/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  createIngredientSchema,
  RECIPE_ERROR_CODES,
  RECIPE_UNITS,
  type CreateIngredientInput,
  type Ingredient,
  type RecipeUnit,
} from '@adatechnology/recipe-contracts'
import { useState, type FormEvent } from 'react'

import { readErrorCode } from '../lib/apiError'
import { fromInputDecimal, toInputDecimal } from '../lib/format'
import { useRecipesApi, useRecipesText } from '../providers/RecipesProvider'
import { Field } from './Field'
import { SelectField } from './SelectField'

export type IngredientDialogProps = {
  /** Ausente: criação. */
  readonly ingredient?: Ingredient
  readonly onSaved: (ingredient: Ingredient) => void
  readonly onCancel: () => void
}

type Form = { name: string; unit: RecipeUnit; cost: string; supplier: string; notes: string }

export function IngredientDialog({ ingredient, onSaved, onCancel }: IngredientDialogProps) {
  const api = useRecipesApi()
  const { messages, locale, format } = useRecipesText()
  const [form, setForm] = useState<Form>({
    name: ingredient?.name ?? '',
    unit: ingredient?.unit ?? 'kg',
    cost: ingredient ? toInputDecimal({ value: ingredient.costPerUnit, locale }) : '',
    supplier: ingredient?.supplier ?? '',
    notes: ingredient?.notes ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [submitError, setSubmitError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  function change(field: keyof Form, value: string): void {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function validate(): CreateIngredientInput | undefined {
    const cost = form.cost.trim() ? fromInputDecimal(form.cost) : '0'
    const next: Partial<Record<keyof Form, string>> = {}
    if (!form.name.trim()) next.name = messages.requiredField
    if (cost === undefined) next.cost = messages.invalidDecimal
    setErrors(next)
    if (Object.keys(next).length > 0 || cost === undefined) return undefined
    const input = { name: form.name, unit: form.unit, costPerUnit: cost, supplier: form.supplier || null, notes: form.notes || null }
    return createIngredientSchema.safeParse(input).success ? input : undefined
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const input = validate()
    if (!input) return
    setIsSaving(true)
    setSubmitError(undefined)
    try {
      const saved = ingredient && api.updateIngredient ? await api.updateIngredient(ingredient.id, input) : await api.createIngredient?.(input)
      if (saved) onSaved(saved)
    } catch (error) {
      setSubmitError(readErrorCode(error) === RECIPE_ERROR_CODES.UNIT_CHANGE_IN_USE ? messages.unitChangeInUse : messages.genericError)
    } finally {
      setIsSaving(false)
    }
  }

  const unitOptions = RECIPE_UNITS.map((unit) => ({ id: unit, label: messages[`unit_${unit}`] }))
  return (
    <div className="arc-root arc-scrim" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <form className="arc-dialog" role="dialog" aria-modal="true" aria-labelledby="arc-ingredient-title" onSubmit={handleSubmit}>
        <h2 className="arc-title" id="arc-ingredient-title">
          {ingredient ? messages.editIngredient : messages.newIngredient}
        </h2>
        <div className="arc-grid">
          <Field id="arc-ingredient-name" label={messages.fieldName} {...(errors.name ? { error: errors.name } : {})}>
            {(aria) => (
              <input id="arc-ingredient-name" className="arc-input" value={form.name} maxLength={160} onChange={(event) => change('name', event.target.value)} {...aria} />
            )}
          </Field>
          <SelectField id="arc-ingredient-unit" label={messages.fieldUnit} value={form.unit} options={unitOptions} onChange={(value) => change('unit', value)} />
          <Field
            id="arc-ingredient-cost"
            label={messages.fieldCostPerUnit}
            hint={format('fieldCostPerUnitHint', { unit: messages[`unit_${form.unit}`] })}
            {...(errors.cost ? { error: errors.cost } : {})}
          >
            {(aria) => (
              <input id="arc-ingredient-cost" className="arc-input arc-number-input" inputMode="decimal" value={form.cost} onChange={(event) => change('cost', event.target.value)} {...aria} />
            )}
          </Field>
          <Field id="arc-ingredient-supplier" label={messages.fieldSupplier}>
            {(aria) => (
              <input id="arc-ingredient-supplier" className="arc-input" value={form.supplier} maxLength={160} onChange={(event) => change('supplier', event.target.value)} {...aria} />
            )}
          </Field>
        </div>
        <Field id="arc-ingredient-notes" label={messages.fieldNotes}>
          {(aria) => (
            <textarea id="arc-ingredient-notes" className="arc-input arc-textarea" value={form.notes} maxLength={2000} onChange={(event) => change('notes', event.target.value)} {...aria} />
          )}
        </Field>
        {submitError ? (
          <p className="arc-error" role="alert">
            {submitError}
          </p>
        ) : null}
        <div className="arc-form-actions">
          <button type="button" className="arc-button arc-button--ghost" onClick={onCancel}>
            {messages.cancel}
          </button>
          <button type="submit" className="arc-button" disabled={isSaving}>
            {isSaving ? messages.saving : messages.save}
          </button>
        </div>
      </form>
    </div>
  )
}
