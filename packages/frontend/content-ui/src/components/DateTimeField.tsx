/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ReactNode } from 'react'

import type { DateTimeInputProps, RenderDateTimeInput } from '../providers/types'

type DateTimeFieldProps = DateTimeInputProps & { readonly renderDateTimeInput?: RenderDateTimeInput | undefined }

/** Seletor do host quando injetado; `datetime-local` nativo só como padrão de quem não injeta nada. */
export function DateTimeField({ renderDateTimeInput, ...props }: DateTimeFieldProps): ReactNode {
  if (renderDateTimeInput) return renderDateTimeInput(props)
  return (
    <div className="adc-field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        type="datetime-local"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </div>
  )
}
