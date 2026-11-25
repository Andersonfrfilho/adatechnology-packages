import { useMemo } from 'react'
import type { Weekday } from './providers/types'
import { WEEKDAYS } from './providers/types'
import { toggleWeekday } from './lib/productFields'

export type AvailabilityScheduleDraft = {
  readonly weekdays: readonly Weekday[]
  readonly from: string
  readonly until: string
  readonly timeZone: string
}

export type AvailabilityScheduleEditorProps = {
  readonly value: AvailabilityScheduleDraft
  readonly onChange: (value: AvailabilityScheduleDraft) => void
  readonly locale: string
  readonly error?: string
}

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

// 2023-01-01 foi domingo: somar `day` dias dá o dia da semana pedido, já no idioma do consumidor.
function weekdayLabels(locale: string): Record<Weekday, string> {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  return Object.fromEntries(
    WEEKDAYS.map((day) => [day, formatter.format(new Date(Date.UTC(2023, 0, 1 + day)))]),
  ) as Record<Weekday, string>
}

export function AvailabilityScheduleEditor({ value, onChange, locale, error }: AvailabilityScheduleEditorProps) {
  const labels = useMemo(() => weekdayLabels(locale), [locale])

  return (
    <fieldset className="space-y-3">
      <legend className={LABEL_CLASS}>Dias e horário de venda</legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Dias da semana">
        {WEEKDAYS.map((day) => {
          const selected = value.weekdays.includes(day)
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange({ ...value, weekdays: toggleWeekday(value.weekdays, day) })}
              className={`px-3 py-1.5 min-h-9 rounded-full text-xs font-medium border transition-colors ${
                selected
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {labels[day]}
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="product-schedule-from">Das</label>
          <input
            id="product-schedule-from"
            type="time"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="product-schedule-until">Até</label>
          <input
            id="product-schedule-until"
            type="time"
            value={value.until}
            onChange={(e) => onChange({ ...value, until: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Deixe o horário vazio para o dia inteiro. Se o fim for antes do início, a janela atravessa a madrugada.
      </p>
      <div>
        <label className={LABEL_CLASS} htmlFor="product-schedule-timezone">Fuso horário (opcional)</label>
        <input
          id="product-schedule-timezone"
          type="text"
          value={value.timeZone}
          onChange={(e) => onChange({ ...value, timeZone: e.target.value })}
          className={INPUT_CLASS}
          placeholder="America/Sao_Paulo"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </fieldset>
  )
}
