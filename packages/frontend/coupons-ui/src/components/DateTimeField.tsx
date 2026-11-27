/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCouponsContext } from '../providers/CouponsProvider'
import type { DateTimeInputProps } from '../providers/types'

export function DateTimeField(props: DateTimeInputProps & { readonly error?: string }) {
  const { renderDateTimeInput } = useCouponsContext()
  if (renderDateTimeInput) return <>{renderDateTimeInput(props)}</>
  return (
    <div className={`acp-field${props.error ? ' acp-field--invalid' : ''}`} data-field={props.id}>
      <label className="acp-label" htmlFor={props.id}>
        {props.label}
      </label>
      <input
        className="acp-input"
        id={props.id}
        type="datetime-local"
        value={props.value}
        aria-invalid={Boolean(props.error)}
        aria-describedby={props.error ? `${props.id}-error` : undefined}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {props.error ? (
        <p className="acp-error" id={`${props.id}-error`} role="alert">
          {props.error}
        </p>
      ) : null}
    </div>
  )
}
