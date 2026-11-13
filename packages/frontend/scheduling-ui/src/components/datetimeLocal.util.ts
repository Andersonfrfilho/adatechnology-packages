/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * M-5 (T9.3): o valor de um `<input type="datetime-local">` é texto sem fuso — `new Date(value)`
 * interpreta esses números no fuso do navegador de quem está operando, não no fuso declarado do
 * recurso. Um operador em outro fuso vê e agenda um horário diferente do que o cliente combinou.
 */

function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)

  const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? 0)
  // `hour` pode vir "24" em algumas implementações de ICU para meia-noite — normaliza para 0.
  const asUtcOfWallClock = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  return asUtcOfWallClock - instant.getTime()
}

/** Converte o texto de um `datetime-local` (`YYYY-MM-DDTHH:mm`) para o instante UTC no fuso dado. */
export function parseDateTimeLocalInTimeZone(value: string, timeZone: string): Date {
  const naiveUtc = new Date(`${value}:00.000Z`)
  // Duas passagens: a primeira estima o offset a partir do instante ingênuo, a segunda corrige
  // usando o offset do instante já ajustado — evita erro de até 1h perto de transição de DST.
  const firstOffset = getTimeZoneOffsetMs(naiveUtc, timeZone)
  const firstPass = new Date(naiveUtc.getTime() - firstOffset)
  const secondOffset = getTimeZoneOffsetMs(firstPass, timeZone)
  return new Date(naiveUtc.getTime() - secondOffset)
}

/** Formata um instante como texto de `datetime-local` (`YYYY-MM-DDTHH:mm`) no fuso dado. */
export function formatDateTimeLocalInTimeZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)

  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '00'
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}
