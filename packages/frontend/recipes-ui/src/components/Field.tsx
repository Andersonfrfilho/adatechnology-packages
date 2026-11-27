/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ReactNode } from 'react'

export type FieldProps = {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly error?: string
  /** Recebe os atributos de acessibilidade que o controle precisa (`aria-invalid`, `aria-describedby`). */
  readonly children: (aria: { 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode
}

/** Rótulo, dica e erro ancorado no campo: editar o campo é o que limpa o erro (quem chama zera). */
export function Field({ id, label, hint, error, children }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className={`arc-field${error ? ' arc-field--invalid' : ''}`} data-field={id}>
      <label className="arc-label" htmlFor={id}>
        {label}
      </label>
      {children({ 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint ? (
        <p className="arc-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="arc-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
