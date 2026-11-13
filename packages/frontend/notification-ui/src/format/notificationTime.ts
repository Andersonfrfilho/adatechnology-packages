/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Quando o aviso chegou, dito do jeito que se diz em voz alta.
 *
 * `Intl` faz o trabalho de idioma — o pacote não guarda "há", "ago" nem nome de mês em lugar nenhum,
 * o que manteria `web.md` §6 de pé e ainda assim quebraria no primeiro locale novo. O que é decisão
 * nossa são as faixas: segundo, minuto, hora, dia, e a virada para data absoluta.
 */

const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Passada uma semana, o relativo para de informar e passa a exigir conta: "há 43 dias" é um convite
 * a abrir o calendário. A data, o leitor lê.
 */
const RELATIVE_HORIZON = 7 * DAY

function parseInstant(isoTimestamp: string): Date | undefined {
  const instant = new Date(isoTimestamp)
  return Number.isNaN(instant.getTime()) ? undefined : instant
}

export function formatNotificationTime(isoTimestamp: string, locale: string, now: Date): string {
  const instant = parseInstant(isoTimestamp)
  if (!instant) return ''

  // Relógio do navegador adiantado é rotina; anunciar "daqui a 2 minutos" para algo que já chegou
  // não é. O piso em zero transforma o desvio em "agora", que é o que de fato aconteceu.
  const elapsed = Math.max(0, now.getTime() - instant.getTime())

  if (elapsed >= RELATIVE_HORIZON) {
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(instant)
  }

  // `numeric: 'auto'` é o que troca "há 1 dia" por "ontem" e "há 0 segundos" por "agora".
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (elapsed < MINUTE) return relative.format(0, 'second')
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), 'hour')
  return relative.format(-Math.floor(elapsed / DAY), 'day')
}

/** O instante inteiro, para o `title` — é a hora que o texto relativo esconde. */
export function formatNotificationTimestamp(isoTimestamp: string, locale: string): string {
  const instant = parseInstant(isoTimestamp)
  if (!instant) return ''

  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(instant)
}
