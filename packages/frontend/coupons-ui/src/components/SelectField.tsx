/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCouponsContext } from '../providers/CouponsProvider'
import type { SelectInputProps } from '../providers/types'

/** Menu do host quando injetado; senão `<select>` nativo — usado só em listas curtas e fixas. */
export function SelectField(props: SelectInputProps) {
  const { renderSelect } = useCouponsContext()
  if (renderSelect) return <>{renderSelect(props)}</>
  return (
    <div className="acp-field">
      <label className="acp-label" htmlFor={props.id}>
        {props.label}
      </label>
      <select
        className="acp-input"
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
