/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O texto de um `datetime-local` (`YYYY-MM-DDTHH:mm`) quebrado em partes editáveis e remontado.
 *
 * Aritmética de calendário fora do componente porque é onde o erro se esconde: 31 de março com o
 * mês trocado para fevereiro vira 3 de março se ninguém aparar o dia, e o operador só descobre
 * depois de salvar. Sendo função pura, o caso do ano bissexto é teste, não tentativa e erro na tela.
 */

const DATE_TIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

export type DateTimeParts = {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly time: string
}

export const MONTHS_IN_YEAR = 12

export function parseDateTimeParts(value: string): DateTimeParts | undefined {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value)
  if (!match) return undefined

  const [, year, month, day, hour, minute] = match as unknown as [string, string, string, string, string, string]

  return { year: Number(year), month: Number(month), day: Number(day), time: `${hour}:${minute}` }
}

/** `Date.UTC` com dia 0 devolve o último dia do mês anterior — 28, 29, 30 ou 31, sem tabela. */
export function daysInMonth(params: { readonly year: number; readonly month: number }): number {
  return new Date(Date.UTC(params.year, params.month, 0)).getUTCDate()
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Remonta o texto já aparando o dia que não existe no mês escolhido. */
export function formatDateTimeParts(parts: DateTimeParts): string {
  const lastDay = daysInMonth({ year: parts.year, month: parts.month })
  const day = Math.min(Math.max(parts.day, 1), lastDay)

  return `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(day)}T${parts.time}`
}

/**
 * Os anos que o seletor oferece, sempre incluindo o que já está no campo.
 *
 * Uma reserva antiga aberta para consulta cai fora da janela em torno de hoje, e um select sem o
 * próprio valor mostra outro ano — o campo passaria a mentir sobre o que está gravado.
 */
export function buildYearOptions(params: {
  readonly year: number
  readonly today: Date
  readonly past: number
  readonly future: number
}): readonly number[] {
  const current = params.today.getFullYear()
  const first = Math.min(current - params.past, params.year)
  const last = Math.max(current + params.future, params.year)

  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}
