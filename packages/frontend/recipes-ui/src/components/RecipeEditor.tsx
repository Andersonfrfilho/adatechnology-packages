/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Ficha técnica de um produto do host: rendimento, tempo e modo de preparo, insumos e o custo ao vivo.
 * O host abre dentro da tela do produto e passa o preço de venda para a margem.
 */

import { useState } from 'react'

import { useRecipeEditor } from '../hooks/useRecipeEditor'
import { useRecipesApi, useRecipesText } from '../providers/RecipesProvider'
import { ConfirmDialog } from './ConfirmDialog'
import { Feedback } from './Feedback'
import { Field } from './Field'
import { IngredientPicker } from './IngredientPicker'
import { RecipeCostSummary } from './RecipeCostSummary'
import { RecipeLines } from './RecipeLines'

export type RecipeEditorProps = {
  readonly productId: string
  /** Mostrado no título; o módulo não conhece o nome do produto. */
  readonly productName?: string
  /** Preço de venda atual do produto no catálogo do host, em centavos. */
  readonly salePriceCents?: number
  /** Depois de salvar ou excluir (o host atualiza o custo na lista do catálogo). */
  readonly onSaved?: () => void
}

export function RecipeEditor({ productId, productName, salePriceCents, onSaved }: RecipeEditorProps) {
  const api = useRecipesApi()
  const { messages, locale } = useRecipesText()
  const editor = useRecipeEditor({ productId, ...(salePriceCents !== undefined ? { salePriceCents } : {}) })
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false)
  const isReadOnly = !api.saveRecipe

  if (editor.status === 'loading') return <p className="arc-root arc-empty">{messages.loading}</p>
  if (editor.status === 'error')
    return (
      <div className="arc-root arc-empty" role="alert">
        <p>{messages.loadError}</p>
        <button type="button" className="arc-button arc-button--ghost" onClick={editor.reload}>
          {messages.retry}
        </button>
      </div>
    )

  const yieldError = editor.errors.yieldPortions
  const timeError = editor.errors.preparationTimeMinutes
  return (
    <section className="arc-root arc-editor" aria-labelledby="arc-recipe-title" lang={locale}>
      <h2 className="arc-title" id="arc-recipe-title">
        {productName ? `${messages.recipeTitle} · ${productName}` : messages.recipeTitle}
      </h2>
      {!editor.hasRecipe ? <p className="arc-hint">{messages.recipeEmpty}</p> : null}
      <div className="arc-grid">
        <Field id="arc-recipe-yield" label={messages.yieldPortions} {...(yieldError ? { error: yieldError } : {})}>
          {(aria) => (
            <input id="arc-recipe-yield" className="arc-input arc-number-input" inputMode="decimal" readOnly={isReadOnly} value={editor.draft.yieldPortions} onChange={(event) => editor.setField('yieldPortions', event.target.value)} {...aria} />
          )}
        </Field>
        <Field id="arc-recipe-time" label={messages.preparationTime} {...(timeError ? { error: timeError } : {})}>
          {(aria) => (
            <input id="arc-recipe-time" className="arc-input arc-number-input" inputMode="numeric" readOnly={isReadOnly} value={editor.draft.preparationTimeMinutes} onChange={(event) => editor.setField('preparationTimeMinutes', event.target.value.replace(/\D/g, ''))} {...aria} />
          )}
        </Field>
      </div>
      <section className="arc-section" aria-labelledby="arc-recipe-lines-title">
        <h3 className="arc-subtitle" id="arc-recipe-lines-title">
          {messages.linesTitle}
        </h3>
        <RecipeLines editor={editor} cost={editor.liveCost} isReadOnly={isReadOnly} />
        {!isReadOnly ? (
          <IngredientPicker id="arc-recipe-picker" onPick={editor.addLine} excludedIds={new Set(editor.draft.lines.map((line) => line.ingredientId))} />
        ) : null}
      </section>
      <Field id="arc-recipe-instructions" label={messages.instructions}>
        {(aria) => (
          <textarea id="arc-recipe-instructions" className="arc-input arc-textarea" readOnly={isReadOnly} maxLength={20_000} value={editor.draft.instructions} onChange={(event) => editor.setField('instructions', event.target.value)} {...aria} />
        )}
      </Field>
      <RecipeCostSummary cost={editor.liveCost} />
      <Feedback feedback={editor.feedback} />
      {!isReadOnly ? (
        <div className="arc-form-actions">
          {editor.hasRecipe && api.removeRecipe ? (
            <button type="button" className="arc-button arc-button--danger" onClick={() => setIsConfirmingRemoval(true)}>
              {messages.remove}
            </button>
          ) : null}
          <button type="button" className="arc-button" disabled={editor.isSaving} onClick={() => void editor.save().then((ok) => ok && onSaved?.())}>
            {editor.isSaving ? messages.saving : messages.save}
          </button>
        </div>
      ) : null}
      {isConfirmingRemoval ? (
        <ConfirmDialog
          message={messages.removeRecipeConfirm}
          confirmLabel={messages.remove}
          isDanger
          onCancel={() => setIsConfirmingRemoval(false)}
          onConfirm={() => {
            setIsConfirmingRemoval(false)
            void editor.remove().then((ok) => ok && onSaved?.())
          }}
        />
      ) : null}
    </section>
  )
}
