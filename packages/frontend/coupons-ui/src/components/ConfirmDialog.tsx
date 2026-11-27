/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Confirmação no desenho do pacote (no lugar do `window.confirm` do navegador): foco no "Cancelar",
 * Esc fecha, o foco volta ao botão que abriu.
 */

import { useEffect, useRef } from 'react'

import { useCouponsText } from '../providers/CouponsProvider'

export type ConfirmDialogProps = {
  readonly message: string
  readonly confirmLabel?: string
  readonly isDanger?: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function ConfirmDialog({ message, confirmLabel, isDanger, onConfirm, onCancel }: ConfirmDialogProps) {
  const { messages } = useCouponsText()
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
    <div className="acp-root acp-scrim" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div
        className="acp-dialog acp-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-describedby="acp-confirm-message"
      >
        <p id="acp-confirm-message">{message}</p>
        <div className="acp-form-actions">
          <button type="button" className="acp-button acp-button--ghost" ref={cancelRef} onClick={onCancel}>
            {messages.cancel}
          </button>
          <button
            type="button"
            className={`acp-button${isDanger ? ' acp-button--danger-solid' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? messages.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
