/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

const USD_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' })
const PERCENT_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})
// UTC porque o provedor fecha o ciclo em meia-noite UTC: no fuso de Brasilia o dia 19 apareceria como 18.
const CYCLE_DAY_FORMATTER = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' })
const CYCLE_END_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})
const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'medium' })

export function formatUsd(value: number): string {
  return USD_FORMATTER.format(value)
}

/** `ratio` em 0..1. */
export function formatPercent(ratio: number): string {
  return PERCENT_FORMATTER.format(ratio)
}

/** `divergencePercent` ja vem em pontos percentuais (1.2 = 1,2%). */
export function formatPercentPoints(points: number): string {
  return PERCENT_FORMATTER.format(points / 100)
}

export function formatCycleRange({
  periodStart,
  periodEnd,
}: {
  readonly periodStart: string
  readonly periodEnd: string
}): string {
  return `${CYCLE_DAY_FORMATTER.format(new Date(periodStart))} – ${CYCLE_END_FORMATTER.format(new Date(periodEnd))}`
}

export function formatCheckedDate(isoDate: string): string {
  return DATE_FORMATTER.format(new Date(isoDate))
}

/** So devolve URLs http(s): a fonte vem da API e nao pode virar `javascript:` num link. */
export function resolveSafeUrl(value: string): string | undefined {
  try {
    const url = new URL(value)

    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}
