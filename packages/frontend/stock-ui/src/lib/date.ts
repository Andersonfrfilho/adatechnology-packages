/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/** Máscara enquanto digita: só dígitos, barras no lugar (`01022026` → `01/02/2026`). */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/')
}

/** `dd/mm/aaaa` → fim do dia no fuso do navegador, em ISO; `undefined` se a data não existe. */
export function parseDateInput(text: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim())
  if (!match) return undefined
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day, 23, 59, 59)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined
  return date.toISOString()
}

export function formatDate(params: { readonly value: string; readonly locale: string }): string {
  return new Intl.DateTimeFormat(params.locale, { dateStyle: 'short' }).format(new Date(params.value))
}
