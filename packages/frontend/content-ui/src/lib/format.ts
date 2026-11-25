/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/** Data por extenso no idioma da tela; data inválida volta vazia em vez de "Invalid Date". */
export function formatPostDate(iso: string | null | undefined, locale: string, withTime = false): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(date)
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** ISO → valor de `<input type="datetime-local">`, no fuso de quem está editando. */
export function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Valor do `datetime-local` (hora local, sem fuso) → ISO com fuso, pronto para a API. */
export function fromDateTimeLocalValue(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}
