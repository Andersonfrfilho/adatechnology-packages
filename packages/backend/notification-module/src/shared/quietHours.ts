/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * **Simplificação documentada:** sem uma biblioteca de fuso horário, o offset UTC de uma
 * timezone é lido via `Intl` e tratado como constante ao longo do dia local. Isso é exato para
 * qualquer timezone sem DST (o Brasil não usa DST desde 2019, e é o `defaultTimezone` do
 * ecossistema) e erra por até 1h só na própria janela de troca de horário de verão, em fusos que
 * ainda o praticam. Aceitável para reagendar uma notificação; uma cron de faturamento não usaria
 * este helper sem revisão.
 */

function getUtcOffsetMinutes(timezone: string, at: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
  const offsetLabel = formatter.formatToParts(at).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+0'
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(offsetLabel)
  if (!match?.[1] || !match[2]) return 0
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? '0'))
}

export function currentHHmmInTimezone(timezone: string, at: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at)
}

/** Janela que atravessa a meia-noite (ex.: 22:00–07:00) é `start > end` — tratada como "ou". */
export function isWithinQuietHours(params: { currentHHmm: string; start: string; end: string }): boolean {
  const { currentHHmm, start, end } = params
  if (start <= end) return currentHHmm >= start && currentHHmm < end
  return currentHHmm >= start || currentHHmm < end
}

export function nextAllowedInstant(params: { now: Date; timezone: string; endHHmm: string }): Date {
  const [endHours, endMinutes] = params.endHHmm.split(':').map(Number)
  const offsetMinutes = getUtcOffsetMinutes(params.timezone, params.now)

  const nowUtcMs = params.now.getTime()
  const localDate = new Date(nowUtcMs + offsetMinutes * 60_000)
  const localMidnightMs = Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate())
  const candidateLocalMs = localMidnightMs + ((endHours ?? 0) * 60 + (endMinutes ?? 0)) * 60_000
  const candidateUtcMs = candidateLocalMs - offsetMinutes * 60_000

  return new Date(candidateUtcMs <= nowUtcMs ? candidateUtcMs + 24 * 60 * 60_000 : candidateUtcMs)
}
