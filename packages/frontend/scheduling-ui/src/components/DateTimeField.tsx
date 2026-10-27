/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useId, useMemo } from 'react'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'
import { SelectField, type SelectOption } from './SelectField'
import {
  buildYearOptions,
  daysInMonth,
  formatDateTimeParts,
  MONTHS_IN_YEAR,
  parseDateTimeParts,
  type DateTimeParts,
} from './dateTimeParts.util'

export type DateTimeFieldProps = {
  readonly label: string
  /** Mesmo texto do `datetime-local` (`YYYY-MM-DDTHH:mm`), para o valor não mudar de contrato. */
  readonly value: string
  readonly onChange: (value: string) => void
  /** O dia que abre o campo quando ele começa vazio. */
  readonly emptyDefault?: Date
}

const FIELD_CLASS =
  'min-h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-sm'

/**
 * Mês e dia dispensam a caixa de busca do `SelectField`: são listas fixas e ordinais, onde digitar
 * salta direto para a opção (o `typeahead` do componente) e um filtro por "2" devolveria 2, 12 e
 * 20–29. A regra de busca do `web.md` §11 mira lista que cresce, que não é o caso de nenhum dos dois.
 */

/** Anos oferecidos em torno de hoje; o valor do campo entra mesmo fora da janela. */
const YEAR_WINDOW = { PAST: 1, FUTURE: 2 } as const

function partsOf(value: string, fallback: Date): DateTimeParts {
  return (
    parseDateTimeParts(value) ?? {
      year: fallback.getFullYear(),
      month: fallback.getMonth() + 1,
      day: fallback.getDate(),
      time: '09:00',
    }
  )
}

function monthLabels(locale: string): readonly string[] {
  const format = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })

  return Array.from({ length: MONTHS_IN_YEAR }, (_, index) =>
    format.format(new Date(Date.UTC(2026, index, 1))),
  )
}

/**
 * Data e hora em campos separados, com o ano num seletor.
 *
 * O `datetime-local` nativo esconde o ano atrás de setinha: mudar de 2026 para 2019 numa reserva
 * antiga é doze toques, e no celular o teclado numérico entra no lugar do calendário. Separar em
 * ano, mês, dia e hora custa um campo a mais e resolve o salto — que é a operação real de quem
 * remarca ou bloqueia agenda.
 *
 * O valor continua sendo o mesmo texto do campo nativo: quem chama não muda, e a conversão de fuso
 * segue em `datetimeLocal.util`.
 */
export function DateTimeField({ label, value, onChange, emptyDefault }: DateTimeFieldProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const groupId = useId()

  const today = emptyDefault ?? new Date()
  const parts = partsOf(value, today)
  const years = buildYearOptions({
    year: parts.year,
    today,
    past: YEAR_WINDOW.PAST,
    future: YEAR_WINDOW.FUTURE,
  })
  const days = daysInMonth({ year: parts.year, month: parts.month })
  const months = monthLabels(locale)

  const yearOptions = useMemo<readonly SelectOption[]>(
    () => years.map((year) => ({ value: String(year), label: String(year) })),
    [years],
  )
  const monthOptions = useMemo<readonly SelectOption[]>(
    () => months.map((name, index) => ({ value: String(index + 1), label: name })),
    [months],
  )
  const dayOptions = useMemo<readonly SelectOption[]>(
    () => Array.from({ length: days }, (_, index) => ({ value: String(index + 1), label: String(index + 1) })),
    [days],
  )

  function change(patch: Partial<DateTimeParts>): void {
    onChange(formatDateTimeParts({ ...parts, ...patch }))
  }

  return (
    <div role="group" aria-labelledby={groupId} className="flex flex-wrap items-center gap-2">
      <span id={groupId} className="sr-only">
        {label}
      </span>

      <SelectField
        hideLabel
        label={`${label} — ${messages['datetime.year']}`}
        value={String(parts.year)}
        options={yearOptions}
        onChange={(next) => change({ year: Number(next) })}
        className="min-w-24"
      />

      <SelectField
        hideLabel
        label={`${label} — ${messages['datetime.month']}`}
        value={String(parts.month)}
        options={monthOptions}
        onChange={(next) => change({ month: Number(next) })}
        searchable={false}
        className="min-w-36"
      />

      <SelectField
        hideLabel
        label={`${label} — ${messages['datetime.day']}`}
        value={String(Math.min(parts.day, days))}
        options={dayOptions}
        onChange={(next) => change({ day: Number(next) })}
        searchable={false}
        className="min-w-20"
      />

      <input
        type="time"
        aria-label={`${label} — ${messages['datetime.time']}`}
        value={parts.time}
        onChange={(event) => change({ time: event.target.value })}
        className={FIELD_CLASS}
      />
    </div>
  )
}
