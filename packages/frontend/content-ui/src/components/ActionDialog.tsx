/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { X } from 'lucide-react'
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react'

import { useContentText } from '../providers/ContentProvider'

export type ActionDialogProps = {
  readonly title: string
  readonly confirmLabel: string
  readonly confirmIcon?: ReactNode
  readonly isBusy?: boolean
  readonly error?: string | undefined
  readonly onConfirm: () => void
  readonly onClose: () => void
  readonly children: ReactNode
}

/** Janela modal simples: Esc fecha, foco entra no primeiro campo, Enter confirma. */
export function ActionDialog({
  title,
  confirmLabel,
  confirmIcon,
  isBusy = false,
  error,
  onConfirm,
  onClose,
  children,
}: ActionDialogProps): ReactNode {
  const { messages } = useContentText()
  const titleId = useId()
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('input, button[aria-haspopup], select, textarea')?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    if (!isBusy) onConfirm()
  }

  return (
    <div className="adc-root adc-dialog-backdrop">
      <form
        ref={formRef}
        className="adc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
      >
        <header className="adc-dialog__header">
          <h3 id={titleId} className="adc-dialog__title">
            {title}
          </h3>
          <button
            type="button"
            className="adc-button adc-button--ghost adc-button--icon"
            aria-label={messages.close}
            onClick={onClose}
          >
            <X aria-hidden="true" className="adc-icon" />
          </button>
        </header>
        <div className="adc-dialog__body">{children}</div>
        {error && (
          <p className="adc-error" role="alert">
            {error}
          </p>
        )}
        <footer className="adc-dialog__footer">
          <button type="button" className="adc-button" onClick={onClose}>
            {messages.dialogCancel}
          </button>
          <button type="submit" className="adc-button adc-button--primary" disabled={isBusy}>
            {confirmIcon}
            {confirmLabel}
          </button>
        </footer>
      </form>
    </div>
  )
}
