/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estado da ficha em edição: rascunho, custo ao vivo (o mesmo cálculo do servidor), validação com
 * os schemas do contrato e gravação inteira.
 */

import {
  areUnitsCompatible,
  calculateRecipeCost,
  isPositive,
  parseDecimal,
  saveRecipeSchema,
  type Ingredient,
  type RecipeCost,
  type RecipeDetail,
  type RecipeUnit,
  type SaveRecipeInput,
} from '@adatechnology/recipe-contracts'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { fromInputDecimal, toInputDecimal } from '../lib/format'
import { useRecipesApi, useRecipesText } from '../providers/RecipesProvider'

export type DraftLine = {
  readonly key: string
  readonly id?: string
  readonly ingredientId: string
  /** Como digitado (`"0,5"`). */
  readonly quantity: string
  readonly unit: RecipeUnit
  readonly notes: string
}

export type RecipeDraft = {
  readonly yieldPortions: string
  readonly preparationTimeMinutes: string
  readonly instructions: string
  readonly lines: readonly DraftLine[]
}

export type RecipeEditorStatus = 'loading' | 'ready' | 'error'

export type RecipeEditor = {
  readonly status: RecipeEditorStatus
  readonly hasRecipe: boolean
  readonly draft: RecipeDraft
  readonly ingredients: ReadonlyMap<string, Ingredient>
  readonly liveCost: RecipeCost
  readonly errors: Readonly<Record<string, string>>
  readonly isSaving: boolean
  readonly feedback: { readonly kind: 'success' | 'error'; readonly message: string } | undefined
  readonly setField: (field: 'yieldPortions' | 'preparationTimeMinutes' | 'instructions', value: string) => void
  readonly addLine: (ingredient: Ingredient) => void
  readonly updateLine: (key: string, patch: Partial<Pick<DraftLine, 'quantity' | 'unit' | 'notes'>>) => void
  readonly removeLine: (key: string) => void
  readonly save: () => Promise<boolean>
  readonly remove: () => Promise<boolean>
  readonly reload: () => void
}

const EMPTY_DRAFT: RecipeDraft = { yieldPortions: '1', preparationTimeMinutes: '', instructions: '', lines: [] }

let lineSequence = 0
function nextKey(): string {
  lineSequence += 1
  return `line-${lineSequence}`
}

function draftFrom(detail: RecipeDetail, locale: string): RecipeDraft {
  const { recipe } = detail
  return {
    yieldPortions: toInputDecimal({ value: recipe.yieldPortions, locale }),
    preparationTimeMinutes: recipe.preparationTimeMinutes === null ? '' : String(recipe.preparationTimeMinutes),
    instructions: recipe.instructions,
    lines: recipe.lines.map((line) => ({
      key: nextKey(),
      id: line.id,
      ingredientId: line.ingredientId,
      quantity: toInputDecimal({ value: line.quantity, locale }),
      unit: line.unit,
      notes: line.notes ?? '',
    })),
  }
}

type Validation = { readonly input?: SaveRecipeInput; readonly errors: Record<string, string> }

function validateDraft(params: {
  readonly draft: RecipeDraft
  readonly ingredients: ReadonlyMap<string, Ingredient>
  readonly messages: { invalidDecimal: string; positiveDecimal: string; incompatibleUnit: string }
}): Validation {
  const { draft, messages } = params
  const errors: Record<string, string> = {}
  const positive = (field: string, text: string): string | undefined => {
    const value = fromInputDecimal(text)
    if (value === undefined) errors[field] = messages.invalidDecimal
    else if (!isPositive(parseDecimal(value))) errors[field] = messages.positiveDecimal
    return value
  }
  const yieldPortions = positive('yieldPortions', draft.yieldPortions)
  const minutes = draft.preparationTimeMinutes.trim()
  if (minutes && !/^\d{1,5}$/.test(minutes)) errors.preparationTimeMinutes = messages.invalidDecimal
  const lines = draft.lines.map((line, index) => {
    const quantity = positive(`lines.${index}.quantity`, line.quantity)
    const ingredient = params.ingredients.get(line.ingredientId)
    if (ingredient && !areUnitsCompatible(line.unit, ingredient.unit))
      errors[`lines.${index}.unit`] = messages.incompatibleUnit.replace('{unit}', ingredient.unit)
    return {
      ...(line.id ? { id: line.id } : {}),
      ingredientId: line.ingredientId,
      quantity: quantity ?? '0',
      unit: line.unit,
      notes: line.notes || null,
    }
  })
  if (Object.keys(errors).length > 0) return { errors }
  const input: SaveRecipeInput = {
    yieldPortions: yieldPortions ?? '1',
    preparationTimeMinutes: minutes ? Number(minutes) : null,
    instructions: draft.instructions,
    lines,
  }
  const parsed = saveRecipeSchema.safeParse(input)
  if (!parsed.success)
    return { errors: Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message])) }
  return { input, errors }
}

/** Linhas válidas viram custo na hora; a inválida conta zero até ser corrigida. */
function computeLiveCost(params: {
  readonly productId: string
  readonly draft: RecipeDraft
  readonly ingredients: ReadonlyMap<string, Ingredient>
  readonly salePriceCents: number | undefined
}): RecipeCost {
  const lines = params.draft.lines.flatMap((line) => {
    const quantity = fromInputDecimal(line.quantity)
    return quantity ? [{ id: line.key, ingredientId: line.ingredientId, quantity, unit: line.unit }] : []
  })
  const yieldPortions = fromInputDecimal(params.draft.yieldPortions)
  return calculateRecipeCost({
    recipe: {
      productId: params.productId,
      yieldPortions: yieldPortions && isPositive(parseDecimal(yieldPortions)) ? yieldPortions : '1',
      lines,
    },
    ingredients: [...params.ingredients.values()],
    salePriceCents: params.salePriceCents ?? null,
  })
}

export function useRecipeEditor(params: {
  readonly productId: string
  readonly salePriceCents?: number
}): RecipeEditor {
  const api = useRecipesApi()
  const { messages, locale } = useRecipesText()
  const [status, setStatus] = useState<RecipeEditorStatus>('loading')
  const [hasRecipe, setHasRecipe] = useState(false)
  const [draft, setDraft] = useState<RecipeDraft>(EMPTY_DRAFT)
  const [ingredients, setIngredients] = useState<ReadonlyMap<string, Ingredient>>(new Map())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<RecipeEditor['feedback']>()
  const [attempt, setAttempt] = useState(0)

  const applyDetail = useCallback(
    (detail: RecipeDetail | null) => {
      setHasRecipe(detail !== null)
      setDraft(detail ? draftFrom(detail, locale) : EMPTY_DRAFT)
      setIngredients(new Map((detail?.ingredients ?? []).map((ingredient) => [ingredient.id, ingredient])))
      setErrors({})
    },
    [locale],
  )

  useEffect(() => {
    let isCurrent = true
    setStatus('loading')
    api
      .getRecipe(params.productId)
      .then((detail) => {
        if (!isCurrent) return
        applyDetail(detail)
        setStatus('ready')
      })
      .catch(() => isCurrent && setStatus('error'))
    return () => {
      isCurrent = false
    }
  }, [api, params.productId, attempt, applyDetail])

  const liveCost = useMemo(
    () => computeLiveCost({ productId: params.productId, draft, ingredients, salePriceCents: params.salePriceCents }),
    [params.productId, draft, ingredients, params.salePriceCents],
  )

  async function save(): Promise<boolean> {
    if (!api.saveRecipe) return false
    const validation = validateDraft({ draft, ingredients, messages })
    setErrors(validation.errors)
    setFeedback(undefined)
    if (!validation.input) return false
    setIsSaving(true)
    try {
      const options = params.salePriceCents === undefined ? undefined : { salePriceCents: params.salePriceCents }
      applyDetail(await api.saveRecipe(params.productId, validation.input, options))
      setFeedback({ kind: 'success', message: messages.savedRecipe })
      return true
    } catch {
      setFeedback({ kind: 'error', message: messages.genericError })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function remove(): Promise<boolean> {
    if (!api.removeRecipe) return false
    try {
      await api.removeRecipe(params.productId)
      applyDetail(null)
      setFeedback({ kind: 'success', message: messages.removedRecipe })
      return true
    } catch {
      setFeedback({ kind: 'error', message: messages.genericError })
      return false
    }
  }

  return {
    status,
    hasRecipe,
    draft,
    ingredients,
    liveCost,
    errors,
    isSaving,
    feedback,
    setField: (field, value) => setDraft((current) => ({ ...current, [field]: value })),
    addLine: (ingredient) => {
      setIngredients((current) => new Map(current).set(ingredient.id, ingredient))
      setDraft((current) => ({
        ...current,
        lines: [
          ...current.lines,
          { key: nextKey(), ingredientId: ingredient.id, quantity: '', unit: ingredient.unit, notes: '' },
        ],
      }))
    },
    updateLine: (key, patch) =>
      setDraft((current) => ({
        ...current,
        lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
      })),
    removeLine: (key) =>
      setDraft((current) => ({ ...current, lines: current.lines.filter((line) => line.key !== key) })),
    save,
    remove,
    reload: () => setAttempt((value) => value + 1),
  }
}
