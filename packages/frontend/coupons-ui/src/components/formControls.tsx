/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Controles do editor sobre o `Field`: texto, área, moeda com máscara, inteiro e liga/desliga.
 */

import { formatCentsInput, parseCentsInput } from '../lib/format'
import { Field } from './Field'

type BaseProps = { readonly id: string; readonly label: string; readonly hint?: string; readonly error?: string }

const optional = (hint?: string, error?: string) => ({ ...(hint ? { hint } : {}), ...(error ? { error } : {}) })

export function TextControl(
  props: BaseProps & {
    readonly value: string
    readonly onChange: (value: string) => void
    readonly maxLength?: number
    readonly isUpperCase?: boolean
  },
) {
  return (
    <Field id={props.id} label={props.label} {...optional(props.hint, props.error)}>
      {(aria) => (
        <input
          {...aria}
          className="acp-input"
          id={props.id}
          value={props.value}
          maxLength={props.maxLength}
          autoCapitalize={props.isUpperCase ? 'characters' : undefined}
          spellCheck={props.isUpperCase ? false : undefined}
          onChange={(event) =>
            props.onChange(
              props.isUpperCase ? event.target.value.toUpperCase().replace(/\s+/g, '') : event.target.value,
            )
          }
        />
      )}
    </Field>
  )
}

export function TextAreaControl(
  props: BaseProps & { readonly value: string; readonly onChange: (value: string) => void; readonly rows?: number },
) {
  return (
    <Field id={props.id} label={props.label} {...optional(props.hint, props.error)}>
      {(aria) => (
        <textarea
          {...aria}
          className="acp-input acp-textarea"
          id={props.id}
          rows={props.rows ?? 3}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
      )}
    </Field>
  )
}

/** Moeda: os dígitos digitados são centavos, a máscara "1.234,56" aparece enquanto digita. */
export function MoneyControl(
  props: BaseProps & { readonly value: number | null; readonly onChange: (value: number | null) => void },
) {
  return (
    <Field id={props.id} label={props.label} {...optional(props.hint, props.error)}>
      {(aria) => (
        <input
          {...aria}
          className="acp-input acp-number-input"
          id={props.id}
          inputMode="numeric"
          value={formatCentsInput(props.value)}
          onChange={(event) => props.onChange(parseCentsInput(event.target.value))}
        />
      )}
    </Field>
  )
}

/** Inteiro positivo: só dígitos entram. */
export function IntegerControl(
  props: BaseProps & { readonly value: string; readonly onChange: (value: string) => void },
) {
  return (
    <Field id={props.id} label={props.label} {...optional(props.hint, props.error)}>
      {(aria) => (
        <input
          {...aria}
          className="acp-input acp-number-input"
          id={props.id}
          inputMode="numeric"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value.replace(/\D/g, '').slice(0, 7))}
        />
      )}
    </Field>
  )
}

export function ToggleControl(props: {
  readonly id: string
  readonly label: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly disabled?: boolean
}) {
  return (
    <label className="acp-toggle" htmlFor={props.id} data-field={props.id}>
      <input
        id={props.id}
        type="checkbox"
        role="switch"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      <span>{props.label}</span>
    </label>
  )
}
