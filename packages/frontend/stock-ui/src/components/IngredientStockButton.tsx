/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Botão para o slot `renderRowActions` do `IngredientsWorkspace`: abre o painel de estoque do insumo.
 */

import { Boxes, X } from 'lucide-react'
import { useState } from 'react'

import { useStockText } from '../providers/StockProvider'
import { IngredientStockPanel } from './IngredientStockPanel'

export type IngredientStockButtonProps = {
  readonly ingredientId: string
  readonly ingredientName: string
  readonly onChanged?: () => void
}

export function IngredientStockButton({ ingredientId, ingredientName, onChanged }: IngredientStockButtonProps) {
  const { messages, format } = useStockText()
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <button type="button" className="arc-icon-button" aria-label={messages.stockButton} title={messages.stockButton} onClick={() => setIsOpen(true)}>
        <Boxes aria-hidden="true" className="arc-icon" />
      </button>
      {isOpen ? (
        <div className="arc-root arc-scrim" onClick={(event) => event.target === event.currentTarget && setIsOpen(false)}>
          <div className="arc-dialog ast-dialog" role="dialog" aria-modal="true" aria-labelledby={`ast-panel-${ingredientId}`}>
            <div className="arc-line-head">
              <h2 className="arc-title" id={`ast-panel-${ingredientId}`}>
                {format('stockOf', { name: ingredientName })}
              </h2>
              <button type="button" className="arc-icon-button" aria-label={messages.close} title={messages.close} onClick={() => setIsOpen(false)}>
                <X aria-hidden="true" className="arc-icon" />
              </button>
            </div>
            <IngredientStockPanel ingredientId={ingredientId} {...(onChanged ? { onChanged } : {})} />
          </div>
        </div>
      ) : null}
    </>
  )
}
