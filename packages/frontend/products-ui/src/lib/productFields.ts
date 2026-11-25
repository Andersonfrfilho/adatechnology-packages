import type { AvailabilitySchedule, Weekday } from '../providers/types'
import { WEEKDAYS } from '../providers/types'

export type AttributeEntry = {
  readonly key: string
  readonly value: string
  // Valor original quando não era texto (número, lista...): se o usuário não o editou, volta
  // intacto em vez de virar string.
  readonly original?: unknown
}

export const DEFAULT_PRICE_ON_REQUEST_LABEL = 'Sob consulta'

export function toggleWeekday(weekdays: readonly Weekday[], day: Weekday): Weekday[] {
  const next = weekdays.includes(day) ? weekdays.filter((current) => current !== day) : [...weekdays, day]
  return WEEKDAYS.filter((candidate) => next.includes(candidate))
}

export function attributesToEntries(attributes: Readonly<Record<string, unknown>> | undefined): AttributeEntry[] {
  return Object.entries(attributes ?? {}).map(([key, value]) =>
    typeof value === 'string' ? { key, value } : { key, value: JSON.stringify(value), original: value },
  )
}

// Linhas sem chave são descartadas; chave repetida fica com a última.
export function entriesToAttributes(entries: readonly AttributeEntry[]): Record<string, unknown> {
  const attributes: Record<string, unknown> = {}
  for (const entry of entries) {
    const key = entry.key.trim()
    if (!key) continue
    const unchanged = entry.original !== undefined && JSON.stringify(entry.original) === entry.value
    attributes[key] = unchanged ? entry.original : entry.value
  }
  return attributes
}

// Devolve só os campos preenchidos: `exactOptionalPropertyTypes` não aceita `undefined` explícito.
export function buildSchedule(params: {
  readonly weekdays: readonly Weekday[]
  readonly from: string
  readonly until: string
  readonly timeZone: string
}): AvailabilitySchedule {
  return {
    weekdays: params.weekdays,
    ...(params.from ? { from: params.from } : {}),
    ...(params.until ? { until: params.until } : {}),
    ...(params.timeZone.trim() ? { timeZone: params.timeZone.trim() } : {}),
  }
}

export function validateSchedule(params: { weekdays: readonly Weekday[]; from: string; until: string }): string | undefined {
  if (params.weekdays.length === 0) return 'Selecione ao menos um dia'
  if (params.from && params.from === params.until) return 'Início e fim não podem ser iguais'
  return undefined
}
