/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Filtro de período sem `<input type="date">`: "De" e "Até" com máscara `DD/MM/AAAA`, foco que avança
 * ao completar o primeiro, dias inteiros no fuso da empresa. O host troca pelo seletor de intervalo
 * dele com `renderDateRangeInput`.
 */

import { useRef, useState } from 'react'

import { formatDateInput, maskDateInput, parseDateInput } from '../lib/format'
import { useCouponsContext, useCouponsText } from '../providers/CouponsProvider'
import type { DateRangeInputProps } from '../providers/types'

export function DateRangeField(props: DateRangeInputProps) {
  const { renderDateRangeInput } = useCouponsContext()
  const { messages, format, timeZone } = useCouponsText()
  const [text, setText] = useState({ from: formatDateInput(props.value.from), to: formatDateInput(props.value.to) })
  const toRef = useRef<HTMLInputElement>(null)
  if (renderDateRangeInput) return <>{renderDateRangeInput(props)}</>

  function update(key: 'from' | 'to', raw: string): void {
    const masked = maskDateInput(raw)
    const next = { ...text, [key]: masked }
    setText(next)
    const day = parseDateInput(masked)
    // Só emite com a data completa e válida, ou com o campo vazio (tira o limite).
    if (masked === '' || day) props.onChange({ ...props.value, [key]: day })
    if (key === 'from' && day) toRef.current?.focus()
  }

  const isInverted = Boolean(props.value.from && props.value.to && props.value.from > props.value.to)
  return (
    <fieldset className={`acp-field acp-date-range${isInverted ? ' acp-field--invalid' : ''}`} data-field={props.id}>
      <legend className="acp-label">{props.label}</legend>
      <div className="acp-datetime-row">
        {(['from', 'to'] as const).map((key) => (
          <label key={key} className="acp-range-part" htmlFor={`${props.id}-${key}`}>
            <span className="acp-hint">{key === 'from' ? messages.periodFrom : messages.periodTo}</span>
            <input
              id={`${props.id}-${key}`}
              ref={key === 'to' ? toRef : undefined}
              className="acp-input"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              value={text[key]}
              aria-invalid={isInverted}
              onChange={(event) => update(key, event.target.value)}
            />
          </label>
        ))}
      </div>
      <p className="acp-hint">{timeZone ? format('timeZoneHint', { timeZone }) : messages.timeZoneLocal}</p>
      {isInverted ? (
        <p className="acp-error" role="alert">
          {messages.periodInvalid}
        </p>
      ) : null}
    </fieldset>
  )
}
