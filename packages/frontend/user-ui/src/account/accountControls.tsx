/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Os controles que os formulários de conta desenham são SLOTS: a casa troca por seus próprios componentes
 * (select, campo, botão) sem mexer nos formulários. O padrão é o mínimo para funcionar sem biblioteca de UI.
 */

import type { ComponentType, ReactNode } from 'react'

export type AccountFieldProps = {
  readonly id: string
  readonly label: string
  readonly type?: 'text' | 'password' | 'email' | 'tel'
  readonly value: string
  readonly onChange: (value: string) => void
  readonly error?: string
  readonly hint?: string
  readonly autoComplete?: string
  readonly inputMode?: 'text' | 'numeric' | 'tel' | 'email'
}

export type AccountButtonProps = {
  readonly children: ReactNode
  readonly type?: 'button' | 'submit'
  readonly variant?: 'primary' | 'secondary'
  readonly isDisabled?: boolean
  readonly onClick?: () => void
  /** Com `href` o botão é um link (ex.: abrir o WhatsApp). */
  readonly href?: string
}

export type AccountControls = {
  readonly Field: ComponentType<AccountFieldProps>
  readonly Button: ComponentType<AccountButtonProps>
}

const FIELD = 'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
const BUTTON = 'inline-flex min-h-10 items-center justify-center rounded px-4 text-sm font-semibold disabled:opacity-60'
const PRIMARY = `${BUTTON} bg-blue-600 text-white`
const SECONDARY = `${BUTTON} border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300`

function DefaultField(props: AccountFieldProps) {
  const describedBy = props.error ? `${props.id}-error` : props.hint ? `${props.id}-hint` : undefined
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100" htmlFor={props.id}>
        {props.label}
      </label>
      <input
        aria-describedby={describedBy}
        aria-invalid={props.error ? true : undefined}
        autoComplete={props.autoComplete}
        className={props.error ? `${FIELD} border-red-500` : FIELD}
        id={props.id}
        inputMode={props.inputMode}
        onChange={(event) => props.onChange(event.target.value)}
        type={props.type ?? 'text'}
        value={props.value}
      />
      {props.hint && !props.error ? <p className="mt-1 text-xs text-gray-500" id={`${props.id}-hint`}>{props.hint}</p> : null}
      {props.error ? <p className="mt-1 text-xs text-red-700 dark:text-red-300" id={`${props.id}-error`} role="alert">{props.error}</p> : null}
    </div>
  )
}

function DefaultButton(props: AccountButtonProps) {
  const className = props.variant === 'secondary' ? SECONDARY : PRIMARY
  if (props.href) return <a className={className} href={props.href} rel="noreferrer" target="_blank">{props.children}</a>
  return (
    <button className={className} disabled={props.isDisabled} onClick={props.onClick} type={props.type ?? 'button'}>
      {props.children}
    </button>
  )
}

export const DEFAULT_ACCOUNT_CONTROLS: AccountControls = { Field: DefaultField, Button: DefaultButton }
