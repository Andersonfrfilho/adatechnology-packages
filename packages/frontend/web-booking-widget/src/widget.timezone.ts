/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * O horário mostrado por padrão é sempre o do navegador de quem está agendando.
 *
 * É o que evita o bug clássico da tela: cliente em outro estado marca "14:00" pensando no próprio
 * relógio e chega uma hora depois porque o horário exibido era o do recurso, não o dele.
 */
export function resolveVisitorTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function formatSlotTime(iso: string, timezone: string, locale = 'pt-BR'): string {
  return new Date(iso).toLocaleTimeString(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' })
}

export function formatSlotDate(iso: string, timezone: string, locale = 'pt-BR'): string {
  return new Date(iso).toLocaleDateString(locale, {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

/** `America/Sao_Paulo` → "Sao_Paulo" — rótulo curto quando o fuso do recurso precisa aparecer ao lado. */
export function toShortTimezoneLabel(timezone: string): string {
  const city = timezone.split('/').at(-1)

  return (city ?? timezone).replace(/_/g, ' ')
}
