/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Validação da resposta de uma pergunta do fluxo, por `questionType`.
 *
 * Pura e sem relógio próprio: quem chama passa `now` e o fuso. É o que deixa a mesma regra rodar
 * no runner (servidor) e na prévia do editor (navegador), e ser testada sem congelar o tempo.
 */

import type { FlowAnswerValidation, FlowNodeData } from './flow.types'
import { matchesFlowKeyword, type FlowDateOrder } from './flowText'

/** Palavras de data relativa e ordem dos campos, por idioma. */
export type FlowDateLocale = {
  readonly order: FlowDateOrder
  readonly todayWords: readonly string[]
  readonly tomorrowWords: readonly string[]
  readonly dayAfterTomorrowWords?: readonly string[]
  /** Separador decimal de valores em dinheiro. */
  readonly decimalSeparator: ',' | '.'
}

export const FLOW_DATE_LOCALE_PT_BR: FlowDateLocale = {
  order: 'dmy',
  todayWords: ['hoje'],
  tomorrowWords: ['amanhã'],
  dayAfterTomorrowWords: ['depois de amanhã'],
  decimalSeparator: ',',
}

export const FLOW_DATE_LOCALE_EN_US: FlowDateLocale = {
  order: 'mdy',
  todayWords: ['today'],
  tomorrowWords: ['tomorrow'],
  dayAfterTomorrowWords: ['day after tomorrow'],
  decimalSeparator: '.',
}

export type FlowAnswerRejection =
  | 'empty'
  | 'invalid-format'
  | 'before-min-date'
  | 'not-after-reference'
  | 'below-min'
  | 'above-max'
  | 'too-short'
  | 'too-long'
  | 'before-min-time'
  | 'after-max-time'
  | 'outside-allowed-windows'
  /** Recusada pelo validador do host (`FlowRunnerConfig.validateAnswer`). */
  | 'rejected-by-host'

export type FlowAnswerResult =
  | { readonly isValid: true; readonly value: string | number | null; readonly isSkipped: boolean }
  | { readonly isValid: false; readonly rejection: FlowAnswerRejection }

export type FlowClock = {
  readonly now: Date
  /** IANA (`America/Sao_Paulo`). Ausente, UTC — "hoje" depende do fuso, e o servidor costuma estar em UTC. */
  readonly timeZone?: string
  readonly locale?: FlowDateLocale
}

const DAY_IN_MS = 86_400_000

/** `yyyy-mm-dd` do dia corrente no fuso pedido. */
export function todayInTimeZone(now: Date, timeZone = 'UTC'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

function addDays(isoDate: string, days: number): string {
  const time = Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_IN_MS
  return new Date(time).toISOString().slice(0, 10)
}

function toIsoDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day))
  const isRealDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return isRealDate ? date.toISOString().slice(0, 10) : undefined
}

function relativeDate(text: string, today: string, locale: FlowDateLocale): string | undefined {
  if (matchesFlowKeyword(text, locale.dayAfterTomorrowWords ?? [])) return addDays(today, 2)
  if (matchesFlowKeyword(text, locale.tomorrowWords)) return addDays(today, 1)
  if (matchesFlowKeyword(text, locale.todayWords)) return today
  return undefined
}

function fieldsInOrder(parts: readonly number[], order: FlowDateOrder): { day: number; month: number; year?: number } {
  if (order === 'ymd') return { year: parts[0], month: parts[1]!, day: parts[2]! }
  if (order === 'mdy') return { month: parts[0]!, day: parts[1]!, year: parts[2] }
  return { day: parts[0]!, month: parts[1]!, year: parts[2] }
}

function expandYear(year: number): number {
  return year < 100 ? 2000 + year : year
}

/**
 * Data digitada → `yyyy-mm-dd`, ou `undefined`. Aceita `dd/mm`, `dd/mm/aa`, `dd/mm/aaaa` (separador
 * `/`, `-` ou `.`, na ordem do idioma), `yyyy-mm-dd`, e as palavras relativas do idioma.
 *
 * Sem ano, vale o ano corrente — ou o seguinte, se a data já passou: "05/01" dito em novembro é o
 * janeiro que vem, não o que acabou.
 */
export function parseFlowDate(text: string, clock: FlowClock): string | undefined {
  const locale = clock.locale ?? FLOW_DATE_LOCALE_PT_BR
  const today = todayInTimeZone(clock.now, clock.timeZone)
  const relative = relativeDate(text, today, locale)
  if (relative) return relative

  const trimmed = text.trim()
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed)
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const match = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(trimmed)
  if (!match) return undefined
  const parts = [match[1], match[2], match[3]].filter((part): part is string => part !== undefined).map(Number)
  const { day, month, year } = fieldsInOrder(parts, locale.order === 'ymd' ? 'dmy' : locale.order)

  if (year !== undefined) return toIsoDate(expandYear(year), month, day)

  const currentYear = Number(today.slice(0, 4))
  const thisYear = toIsoDate(currentYear, month, day)
  if (!thisYear) return undefined
  return thisYear < today ? toIsoDate(currentYear + 1, month, day) : thisYear
}

/** Número inteiro da resposta — "4", "somos 4". Dois números na frase é ambíguo e é recusado. */
export function parseFlowInteger(text: string): number | undefined {
  const numbers = text.match(/-?\d+/g)
  if (!numbers || numbers.length !== 1) return undefined
  if (/\d[.,]\d/.test(text)) return undefined
  return Number(numbers[0])
}

/** Valor em dinheiro → número com centavos. "R$ 1.234,56" (pt-BR) e "$1,234.56" (en-US). */
export function parseFlowMoney(text: string, decimalSeparator: ',' | '.' = ','): number | undefined {
  const cleaned = text.replace(/[^\d.,-]/g, '')
  if (!/\d/.test(cleaned)) return undefined
  const thousandsSeparator = decimalSeparator === ',' ? '.' : ','
  // "12.50" escrito por quem usa vírgula: um único separador "errado" seguido de 1-2 dígitos só
  // pode ser decimal — milhar sempre tem 3 dígitos depois.
  const effectiveDecimal =
    !cleaned.includes(decimalSeparator) &&
    new RegExp(`^[^${thousandsSeparator}]*\\${thousandsSeparator}\\d{1,2}$`).test(cleaned)
      ? thousandsSeparator
      : decimalSeparator
  if (effectiveDecimal !== decimalSeparator)
    return parseFlowMoney(cleaned.replace(thousandsSeparator, decimalSeparator), decimalSeparator)
  const lastDecimal = cleaned.lastIndexOf(decimalSeparator)
  const hasDecimals = lastDecimal >= 0 && cleaned.length - lastDecimal - 1 <= 2
  const integerPart = (hasDecimals ? cleaned.slice(0, lastDecimal) : cleaned)
    .split(thousandsSeparator)
    .join('')
    .split(decimalSeparator)
    .join('')
  const decimalPart = hasDecimals ? cleaned.slice(lastDecimal + 1) : ''
  const value = Number(`${integerPart}.${decimalPart || '0'}`)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined
}

/** CPF com dígitos verificadores corretos → só os 11 dígitos. */
export function parseFlowCpf(text: string): string | undefined {
  const digits = text.replace(/\D/g, '')
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return undefined
  const checkDigit = (length: number): number => {
    const sum = [...digits.slice(0, length)].reduce(
      (total, digit, index) => total + Number(digit) * (length + 1 - index),
      0,
    )
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]) ? digits : undefined
}

/**
 * Horário digitado → `HH:MM`, ou `undefined`. Aceita `12:30`, `12h30`, `12h`, `9h`, `9hs` e `12:30h`.
 * Número solto ("12") é recusado: sem `h` ou `:` pode ser quantidade, não hora.
 */
export function parseFlowTime(text: string): string | undefined {
  const match = /^(\d{1,2})\s*(?::\s*(\d{2})\s*(?:h|hs|hrs?)?|(?:h|hs|hrs?)\s*(\d{2})?)$/i.exec(text.trim())
  if (!match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2] ?? match[3] ?? '0')
  if (hours > 23 || minutes > 59) return undefined
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Faixa de horário permitida. `start > end` atravessa a meia-noite (`22:00`–`02:00`). */
export type FlowTimeWindow = { readonly start: string; readonly end: string }

function toTimeWindow(value: unknown): FlowTimeWindow | undefined {
  if (typeof value === 'string') {
    const [start, end] = value.split('-').map((part) => parseFlowTime(part))
    return start && end ? { start, end } : undefined
  }
  if (typeof value !== 'object' || value === null) return undefined
  const { start, end } = value as Record<string, unknown>
  const parsedStart = typeof start === 'string' ? parseFlowTime(start) : undefined
  const parsedEnd = typeof end === 'string' ? parseFlowTime(end) : undefined
  return parsedStart && parsedEnd ? { start: parsedStart, end: parsedEnd } : undefined
}

/**
 * Faixas lidas do contexto: lista de `{ start, end }` ou de `'HH:MM-HH:MM'`. Item malformado é
 * ignorado; `undefined` quando a chave não traz lista — sem lista, não há restrição de faixa.
 */
export function readFlowTimeWindows(value: unknown): FlowTimeWindow[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.map(toTimeWindow).filter((window): window is FlowTimeWindow => window !== undefined)
}

export function isWithinFlowTimeWindow(time: string, window: FlowTimeWindow): boolean {
  if (window.start <= window.end) return time >= window.start && time <= window.end
  return time >= window.start || time <= window.end
}

function reject(rejection: FlowAnswerRejection): FlowAnswerResult {
  return { isValid: false, rejection }
}

function accept(value: string | number | null): FlowAnswerResult {
  return { isValid: true, value, isSkipped: false }
}

function checkRange(value: number, validation: FlowAnswerValidation): FlowAnswerResult {
  if (validation.min !== undefined && value < validation.min) return reject('below-min')
  if (validation.max !== undefined && value > validation.max) return reject('above-max')
  return accept(value)
}

function checkDate(params: {
  readonly answer: string
  readonly validation: FlowAnswerValidation
  readonly context: Readonly<Record<string, unknown>>
  readonly clock: FlowClock
}): FlowAnswerResult {
  const date = parseFlowDate(params.answer, params.clock)
  if (!date) return reject('invalid-format')
  const { minDate, afterContextKey } = params.validation
  const minimum = minDate === 'today' ? todayInTimeZone(params.clock.now, params.clock.timeZone) : minDate
  if (minimum && date < minimum) return reject('before-min-date')
  const reference = afterContextKey ? params.context[afterContextKey] : undefined
  if (typeof reference === 'string' && date <= reference) return reject('not-after-reference')
  return accept(date)
}

function checkTime(params: {
  readonly answer: string
  readonly validation: FlowAnswerValidation
  readonly context: Readonly<Record<string, unknown>>
}): FlowAnswerResult {
  const time = parseFlowTime(params.answer)
  if (!time) return reject('invalid-format')
  const { minTime, maxTime, windowsContextKey } = params.validation
  if (minTime && time < minTime) return reject('before-min-time')
  if (maxTime && time > maxTime) return reject('after-max-time')
  const windows = windowsContextKey ? readFlowTimeWindows(params.context[windowsContextKey]) : undefined
  if (windows && !windows.some((window) => isWithinFlowTimeWindow(time, window))) {
    return reject('outside-allowed-windows')
  }
  return accept(time)
}

function checkText(answer: string, validation: FlowAnswerValidation): FlowAnswerResult {
  const length = Array.from(answer).length
  if (validation.minLength !== undefined && length < validation.minLength) return reject('too-short')
  if (validation.maxLength !== undefined && length > validation.maxLength) return reject('too-long')
  return accept(answer)
}

export type ValidateFlowAnswerParams = {
  readonly node: Pick<FlowNodeData, 'questionType' | 'validation' | 'skipKeywords'>
  readonly answer: string
  readonly context: Readonly<Record<string, unknown>>
  readonly clock: FlowClock
}

/**
 * Valida e converte a resposta: data vira `yyyy-mm-dd`, horário vira `HH:MM`, inteiro e dinheiro viram número, CPF vira
 * os 11 dígitos, texto volta aparado. Palavra de `skipKeywords` aceita com valor `null`.
 *
 * `choice` não passa por aqui: escolha é casar com opção (`matchFlowChoice`), não validar formato.
 */
export function validateFlowAnswer(params: ValidateFlowAnswerParams): FlowAnswerResult {
  const answer = params.answer.trim()
  const validation = params.node.validation ?? {}
  if (params.node.skipKeywords && matchesFlowKeyword(answer, params.node.skipKeywords)) {
    return { isValid: true, value: null, isSkipped: true }
  }
  if (answer.length === 0) return reject('empty')

  switch (params.node.questionType) {
    case 'date':
      return checkDate({ answer, validation, context: params.context, clock: params.clock })
    case 'time':
      return checkTime({ answer, validation, context: params.context })
    case 'int': {
      const value = parseFlowInteger(answer)
      return value === undefined ? reject('invalid-format') : checkRange(value, validation)
    }
    case 'money': {
      const value = parseFlowMoney(answer, (params.clock.locale ?? FLOW_DATE_LOCALE_PT_BR).decimalSeparator)
      return value === undefined ? reject('invalid-format') : checkRange(value, validation)
    }
    case 'cpf': {
      const value = parseFlowCpf(answer)
      return value === undefined ? reject('invalid-format') : accept(value)
    }
    default:
      return checkText(answer, validation)
  }
}
