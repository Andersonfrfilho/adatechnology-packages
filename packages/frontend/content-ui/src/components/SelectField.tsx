/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ReactNode } from 'react'

import type { RenderSelect, SelectInputProps } from '../providers/types'

type SelectFieldProps = SelectInputProps & { readonly renderSelect?: RenderSelect | undefined }

/** Menu do host quando injetado; `<select>` nativo só como padrão de quem não injeta nada. */
export function SelectField({ renderSelect, ...props }: SelectFieldProps): ReactNode {
  if (renderSelect) return renderSelect(props)
  return (
    <div className="adc-field">
      <label htmlFor={props.id}>{props.label}</label>
      <select id={props.id} value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
