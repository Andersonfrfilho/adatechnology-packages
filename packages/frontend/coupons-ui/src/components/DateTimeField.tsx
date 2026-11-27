/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Data e hora sem `datetime-local` nativo (que muda de cara em cada navegador e não aceita máscara):
 * dois campos com máscara — `DD/MM/AAAA` e `HH:MM` —, foco que avança ao completar a data e o fuso
 * da empresa escrito embaixo. O host troca pelo seletor dele com `renderDateTimeInput`.
 */

import { useEffect, useRef, useState } from 'react'

import { joinDateTimeParts, maskDateInput, maskTimeInput, splitDateTimeValue } from '../lib/format'
import { useCouponsContext, useCouponsText } from '../providers/CouponsProvider'
import type { DateTimeInputProps } from '../providers/types'

export function DateTimeField(props: DateTimeInputProps & { readonly error?: string }) {
  const { renderDateTimeInput } = useCouponsContext()
  const { messages, format, timeZone } = useCouponsText()
  const [parts, setParts] = useState(() => splitDateTimeValue(props.value))
  const timeRef = useRef<HTMLInputElement>(null)
  const { value } = props

  // Só valor novo de FORA (outra campanha, salvar) substitui o digitado; o que este campo emitiu não.
  const emittedRef = useRef(value)
  useEffect(() => {
    if (value === emittedRef.current) return
    emittedRef.current = value
    setParts(splitDateTimeValue(value))
  }, [value])

  if (renderDateTimeInput) return <>{renderDateTimeInput(props)}</>

  function update(next: { date: string; time: string }): void {
    setParts(next)
    const joined = joinDateTimeParts(next.date, next.time)
    if (!joined && (next.date || next.time)) return
    emittedRef.current = joined
    props.onChange(joined)
  }

  const isIncomplete = Boolean((parts.date || parts.time) && !joinDateTimeParts(parts.date, parts.time))
  const error =
    props.error ??
    (isIncomplete && parts.date.length === 10 && parts.time.length === 5 ? messages.dateTimeInvalid : undefined)
  const hint = timeZone ? format('timeZoneHint', { timeZone }) : messages.timeZoneLocal
  return (
    <fieldset className={`acp-field acp-datetime${error ? ' acp-field--invalid' : ''}`} data-field={props.id}>
      <legend className="acp-label">{props.label}</legend>
      <div className="acp-datetime-row">
        <label className="acp-visually-hidden" htmlFor={props.id}>
          {`${props.label} — ${messages.fieldDate}`}
        </label>
        <input
          id={props.id}
          className="acp-input"
          inputMode="numeric"
          placeholder="DD/MM/AAAA"
          value={parts.date}
          aria-invalid={Boolean(error)}
          aria-describedby={`${props.id}-hint${error ? ` ${props.id}-error` : ''}`}
          onChange={(event) => {
            const date = maskDateInput(event.target.value)
            update({ ...parts, date })
            if (date.length === 10) timeRef.current?.focus()
          }}
        />
        <label className="acp-visually-hidden" htmlFor={`${props.id}-time`}>
          {`${props.label} — ${messages.fieldTime}`}
        </label>
        <input
          id={`${props.id}-time`}
          ref={timeRef}
          className="acp-input acp-time-input"
          inputMode="numeric"
          placeholder="HH:MM"
          value={parts.time}
          aria-invalid={Boolean(error)}
          onChange={(event) => update({ ...parts, time: maskTimeInput(event.target.value) })}
        />
      </div>
      <p className="acp-hint" id={`${props.id}-hint`}>
        {hint}
      </p>
      {error ? (
        <p className="acp-error" id={`${props.id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
