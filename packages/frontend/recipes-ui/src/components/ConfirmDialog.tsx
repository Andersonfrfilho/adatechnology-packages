/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Confirmação no desenho do pacote (no lugar do `window.confirm` do navegador): foco no "Cancelar",
 * Esc fecha, o foco volta ao botão que abriu.
 */

import { useEffect, useRef } from 'react'

import { useRecipesText } from '../providers/RecipesProvider'

export type ConfirmDialogProps = {
  readonly message: string
  readonly confirmLabel?: string
  readonly isDanger?: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function ConfirmDialog({ message, confirmLabel, isDanger, onConfirm, onCancel }: ConfirmDialogProps) {
  const { messages } = useRecipesText()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      opener?.focus()
    }
  }, [onCancel])

  return (
    <div className="arc-root arc-scrim" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div
        className="arc-dialog arc-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-describedby="arc-confirm-message"
      >
        <p id="arc-confirm-message">{message}</p>
        <div className="arc-form-actions">
          <button type="button" className="arc-button arc-button--ghost" ref={cancelRef} onClick={onCancel}>
            {messages.cancel}
          </button>
          <button
            type="button"
            className={`arc-button${isDanger ? ' arc-button--danger-solid' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? messages.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
