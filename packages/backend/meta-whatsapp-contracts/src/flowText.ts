/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Texto do fluxo: comparação tolerante (acento, caixa, emoji) e interpolação de `{{chave}}`.
 *
 * Vive no contrato porque os dois lados precisam do mesmo resultado: o runner casa a resposta do
 * cliente, o editor mostra na prévia o que o cliente vai ler. Duas cópias divergiriam no primeiro
 * acento.
 */

const MIN_SIGNIFICANT_WORD_LENGTH = 4
const PLACEHOLDER_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Sem acento, sem emoji e pontuação, minúsculo e com espaço simples: "🛒 Ver Preços!" → "ver precos". */
export function normalizeFlowText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

/** `true` quando o texto, normalizado, é uma das palavras (também normalizadas). */
export function matchesFlowKeyword(text: string, keywords: readonly string[]): boolean {
  const normalized = normalizeFlowText(text)
  if (normalized.length === 0) return false
  return keywords.some((keyword) => normalizeFlowText(keyword) === normalized)
}

/**
 * Destino de `next.byKeyword` que a resposta indica: igual à palavra-chave, ou a palavra-chave
 * inteira dentro da frase ("qual o horario de voces" contém "horario"). A chave mais longa vence,
 * para "horario sabado" ganhar de "horario".
 */
export function matchFlowKeywordRoute(text: string, routes: Readonly<Record<string, string>>): string | undefined {
  const normalized = normalizeFlowText(text)
  if (normalized.length === 0) return undefined
  const words = ` ${normalized} `
  const candidates = Object.entries(routes)
    .map(([keyword, target]) => ({ keyword: normalizeFlowText(keyword), target }))
    .filter(({ keyword }) => keyword.length > 0 && words.includes(` ${keyword} `))
    .sort((left, right) => right.keyword.length - left.keyword.length)
  return candidates[0]?.target
}

function significantWords(label: string): string[] {
  return normalizeFlowText(label)
    .split(' ')
    .filter((word) => word.length >= MIN_SIGNIFICANT_WORD_LENGTH)
}

function matchesOption(text: string, option: readonly [string, string]): boolean {
  const [id, label] = option
  const normalizedLabel = normalizeFlowText(label)
  if (normalizedLabel.length > 0 && (text === normalizedLabel || ` ${text} `.includes(` ${normalizedLabel} `)))
    return true
  if (text === normalizeFlowText(id)) return true
  const words = significantWords(label)
  return words.length > 0 && words.every((word) => text.includes(word))
}

/**
 * Id da opção que uma resposta digitada (ou transcrita) indica, ou `undefined` quando não dá para
 * afirmar.
 *
 * Aceita o número da opção ("2"), o rótulo, o id, ou todas as palavras significativas do rótulo em
 * qualquer ordem. Empate devolve `undefined` de propósito: repetir a pergunta custa uma mensagem,
 * mandar o cliente para o caminho errado custa a conversa.
 */
export function matchFlowChoice(answer: string, options: readonly (readonly [string, string])[]): string | undefined {
  const text = normalizeFlowText(answer)
  if (text.length === 0) return undefined

  if (/^\d+$/.test(text)) {
    const byPosition = options[Number(text) - 1]
    if (byPosition) return byPosition[0]
  }

  const exactId = options.find(([id]) => id === answer.trim())
  if (exactId) return exactId[0]

  const matches = options.filter((option) => matchesOption(text, option))
  return matches.length === 1 ? matches[0]![0] : undefined
}

/** Como uma data `yyyy-mm-dd` aparece no texto. `dmy` = 31/12/2026; `mdy` = 12/31/2026. */
export type FlowDateOrder = 'dmy' | 'mdy' | 'ymd'

export function formatFlowDate(isoDate: string, order: FlowDateOrder = 'dmy'): string {
  const match = ISO_DATE_PATTERN.exec(isoDate)
  if (!match) return isoDate
  const [, year, month, day] = match
  if (order === 'mdy') return `${month}/${day}/${year}`
  if (order === 'ymd') return isoDate
  return `${day}/${month}/${year}`
}

export type InterpolateFlowTextOptions = {
  /** Como escrever as datas `yyyy-mm-dd` guardadas no contexto. Padrão `dmy`. */
  readonly dateOrder?: FlowDateOrder
  /** Formata o valor antes de entrar no texto. Recebe a chave para o host decidir por campo. */
  readonly formatValue?: (params: { readonly key: string; readonly value: unknown }) => string | undefined
}

function readPath(variables: Readonly<Record<string, unknown>>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, variables)
}

function stringify(value: unknown, options: InterpolateFlowTextOptions): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return ISO_DATE_PATTERN.test(value) ? formatFlowDate(value, options.dateOrder) : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

/**
 * Troca `{{chave}}` (ou `{{objeto.campo}}`) pelo valor. Chave ausente vira texto vazio — mostrar
 * `{{nome}}` literal ao cliente é pior que omitir o nome. Objetos não são serializados.
 */
export function interpolateFlowText(
  template: string,
  variables: Readonly<Record<string, unknown>>,
  options: InterpolateFlowTextOptions = {},
): string {
  return template.replace(PLACEHOLDER_PATTERN, (_placeholder, key: string) => {
    const value = readPath(variables, key)
    const custom = options.formatValue?.({ key, value })
    return custom ?? stringify(value, options)
  })
}

/** Chaves `{{...}}` usadas num texto — o editor mostra quais variáveis o nó espera. */
export function listFlowPlaceholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]!)
}
