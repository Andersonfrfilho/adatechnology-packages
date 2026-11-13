/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Regras genéricas de e-mail HTML (spec 274 T1.1), sem vocabulário de produto: escape, interpolação "valor
 * escapado, HTML do sistema pelo nome", bloqueio de conteúdo ativo, texto simples a partir do HTML, o desenho do
 * logo/iniciais e das marcas do rodapé. Puras e sem dependência.
 *
 * Mora aqui, e não no host, pelo mesmo motivo do `renderTemplate`: a API, o painel e a prévia precisam da MESMA
 * regra, e duas cópias divergiriam. As tabelas de caso são as da spec 272 do TransportAdA.
 */

/** Cores fixas (`color-scheme: light`): e-mail não herda tema. */
export const STANDARD_EMAIL_THEME = {
  colors: {
    asphalt: '#10222c',
    copper: '#d58a47',
    ink: '#1d2b33',
    mist: '#f0f2ee',
    rule: '#d9ded8',
    slate: '#5a6b74',
  },
  font: 'Arial,Helvetica,sans-serif',
  /** O quadrado do logo (e das iniciais), em pixels. */
  logoSize: 48,
} as const

const { asphalt, copper, slate } = STANDARD_EMAIL_THEME.colors
const { font: FONT, logoSize: LOGO_SIZE } = STANDARD_EMAIL_THEME

const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** `&` sempre primeiro: escapar os outros antes duplicaria o `&amp;` que eles introduzem. */
export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => HTML_ESCAPE_MAP[character] ?? character)
}

// ---------------------------------------------------------------------------------------------------------------
// HTML inseguro
// ---------------------------------------------------------------------------------------------------------------

export type UnsafeEmailHtmlRule = 'event' | 'placeholder_in_tag' | 'scheme' | 'tag'

const UNSAFE_TAG_REGEX = /<(?:script|iframe|form|object|embed)\b/iu
const EVENT_REGEX = /[\s/"']on[a-z]+\s*=/iu
const SCHEME_REGEX = /(?:javascript|vbscript):/iu
/**
 * `{{` dentro de uma tag aberta: atributos entre aspas podem conter `>` e o `{{` pode estar dentro do valor entre
 * aspas. Fora disso, `{{` dentro de `<style>…</style>` (CSS injetável).
 *
 * O que vem depois do `<` e conta como abertura: letra ASCII (tag), `/` (tag de fechamento), `!` (declaração) e `?`
 * (comentário "bogus"), todos tratados pelo navegador como marcação; `%` (resíduo de `<% %>`, não é tag no HTML5, mas
 * parsers legados o tratam como tal) e `{{` colado ou depois de espaço — se o valor substituído começar com uma letra,
 * `<{{x}}>` vira tag (`name = "img src=x onerror=…"`). `< x` seguido de espaço é texto no navegador, mas bloquear é
 * barato: quem quer um `<` literal usa `&lt;`.
 */
const PLACEHOLDER_IN_TAG_REGEX =
  /<(?:[a-zA-Z/!?%]|(?=\s*\{\{))(?:[^>"']|"[^"]*"|'[^']*')*(?:\{\{|"[^"]*\{\{|'[^']*\{\{)/u
const PLACEHOLDER_IN_STYLE_REGEX = /<style\b(?:(?!<\/style\b)[\s\S])*?\{\{/iu
// eslint-disable-next-line no-control-regex -- exatamente `[\u0000- ]` (controles e espaço)
const CONTROL_AND_SPACE_REGEX = /[\u0000- ]/gu
const NUMERIC_ENTITY_REGEX = /&#(?:x([0-9a-f]+)|([0-9]+));?/giu
const NAMED_ENTITY_REGEX = /&(colon|tab|newline);/giu
const NAMED_ENTITY_VALUE: Readonly<Record<string, string>> = { colon: ':', newline: '\n', tab: '\t' }
const MAX_CODE_POINT = 0x10ffff

function decodeCodePoint(code: number): string {
  return Number.isFinite(code) && code <= MAX_CODE_POINT ? String.fromCodePoint(code) : ''
}

/** A cópia em que o esquema é procurado: entidades decodificadas (uma vez) e `[\u0000- ]` removidos. */
function normalizeForScheme(html: string): string {
  return html
    .replace(NUMERIC_ENTITY_REGEX, (_entity, hex: string | undefined, decimal: string | undefined) =>
      decodeCodePoint(hex === undefined ? Number.parseInt(decimal ?? '', 10) : Number.parseInt(hex, 16)),
    )
    .replace(NAMED_ENTITY_REGEX, (_entity, name: string) => NAMED_ENTITY_VALUE[name.toLowerCase()] ?? '')
    .replace(CONTROL_AND_SPACE_REGEX, '')
}

/**
 * Bloqueio de conteúdo ativo, não um sanitizador: o autor do modelo é usuário interno. Vazio é HTML seguro.
 */
export function findUnsafeEmailHtml(html: string): readonly UnsafeEmailHtmlRule[] {
  return [
    ...(UNSAFE_TAG_REGEX.test(html) ? (['tag'] as const) : []),
    ...(EVENT_REGEX.test(html) ? (['event'] as const) : []),
    ...(SCHEME_REGEX.test(normalizeForScheme(html)) ? (['scheme'] as const) : []),
    ...(PLACEHOLDER_IN_TAG_REGEX.test(html) || PLACEHOLDER_IN_STYLE_REGEX.test(html)
      ? (['placeholder_in_tag'] as const)
      : []),
  ]
}

// ---------------------------------------------------------------------------------------------------------------
// HTML → texto
// ---------------------------------------------------------------------------------------------------------------

const COMMENT_REGEX = /<!--[\s\S]*?-->/gu
const DROPPED_ELEMENT_REGEX = /<(head|style|title)\b[^>]*>[\s\S]*?<\/\1\s*>/giu
const LINE_BREAK_REGEX = /<br\b[^>]*>|<\/(?:p|div|tr|li|h[1-6]|table)\s*>/giu
const CELL_END_REGEX = /<\/(?:td|th)\s*>/giu
const TAG_REGEX = /<\/?[a-zA-Z][^>]*>/gu
const TEXT_ENTITY_REGEX = /&(?:#x([0-9a-f]+)|#([0-9]+)|(amp|lt|gt|quot|apos|nbsp));/giu
const TEXT_NAMED_ENTITY: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}
const SURROGATE_MIN = 0xd800
const SURROGATE_MAX = 0xdfff
const HORIZONTAL_SPACE_RUN = /[^\S\n]+/gu
const BLANK_LINE_RUN = /\n{3,}/gu

/** NUL e substituto solto (U+D800–U+DFFF) não são texto: UTF-8 inválido ou derruba a gravação. */
function isValidScalar(code: number): boolean {
  const isSurrogate = code >= SURROGATE_MIN && code <= SURROGATE_MAX
  return Number.isFinite(code) && code > 0 && code <= MAX_CODE_POINT && !isSurrogate
}

/** Uma passada só: cada entidade é decodificada uma vez, então `&amp;lt;` vira `&lt;`, nunca `<`. */
function decodeEntities(text: string): string {
  return text.replace(
    TEXT_ENTITY_REGEX,
    (_entity, hex: string | undefined, decimal: string | undefined, named: string | undefined) => {
      if (named !== undefined) return TEXT_NAMED_ENTITY[named.toLowerCase()] ?? ''
      const code = hex === undefined ? Number.parseInt(decimal ?? '', 10) : Number.parseInt(hex, 16)
      return isValidScalar(code) ? String.fromCodePoint(code) : ''
    },
  )
}

/** A parte `text/plain` gerada do HTML renderizado. Sem biblioteca. */
export function htmlToPlainText(html: string): string {
  const withoutNoise = html.replace(COMMENT_REGEX, '').replace(DROPPED_ELEMENT_REGEX, '')
  const withBreaks = withoutNoise.replace(LINE_BREAK_REGEX, '\n').replace(CELL_END_REGEX, ' ').replace(TAG_REGEX, '')
  return decodeEntities(withBreaks)
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.replace(HORIZONTAL_SPACE_RUN, ' ').trim())
    .join('\n')
    .replace(BLANK_LINE_RUN, '\n\n')
    .trim()
}

// ---------------------------------------------------------------------------------------------------------------
// Interpolação
// ---------------------------------------------------------------------------------------------------------------

/** O padrão do pacote (`extractTemplatePlaceholders`). */
const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu
const NEWLINE_REGEX = /\r\n|\r|\n/gu

export type InterpolateEmailHtmlParams = {
  /** HTML pronto, montado só pelo sistema (já escapa o que carrega); só os nomes de `systemHtmlNames` valem. */
  readonly systemHtml: Readonly<Record<string, string>>
  /** O conjunto fechado de chaves de HTML do sistema, decidido pelo nome. */
  readonly systemHtmlNames: readonly string[]
  readonly template: string
  /** Texto cru: é escapado na saída. */
  readonly values: Readonly<Record<string, string>>
}

function lookup(source: Readonly<Record<string, string>>, name: string): string {
  return Object.hasOwn(source, name) ? (source[name] ?? '') : ''
}

/** O valor é texto: escapado, e a quebra de linha dele vira `<br>` (o HTML a colapsaria num espaço). */
function escapeValue(value: string): string {
  return escapeEmailHtml(value).replace(NEWLINE_REGEX, '<br>')
}

/**
 * Uma varredura só sobre o texto do **modelo**: o valor é escapado, exceto as chaves do conjunto fechado, decididas
 * pelo nome. O valor nunca é reinterpretado.
 */
export function interpolateEmailHtml(params: InterpolateEmailHtmlParams): string {
  const { systemHtml, systemHtmlNames, template, values } = params
  const names: ReadonlySet<string> = new Set(systemHtmlNames)
  return template.replace(PLACEHOLDER_REGEX, (_match, name: string) =>
    names.has(name) ? lookup(systemHtml, name) : escapeValue(lookup(values, name)),
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Logo, iniciais e marcas
// ---------------------------------------------------------------------------------------------------------------

const INITIALS_LENGTH = 2
const INITIAL_PATTERN = /^[\p{L}\p{N}]/u
const WHITESPACE = /\s+/u

/** As primeiras letras das duas primeiras palavras, em maiúscula; pontuação solta não conta. */
export function buildInitials(name: string): string {
  return name
    .split(WHITESPACE)
    .filter((word) => INITIAL_PATTERN.test(word))
    .slice(0, INITIALS_LENGTH)
    .map((word) => (Array.from(word)[0] ?? '').toLocaleUpperCase('pt-BR'))
    .join('')
}

export type EmailLogo = { readonly contentId: string; readonly kind: 'cid' } | { readonly kind: 'initials' }

/** `<img src="cid:…">` (a parte inline vai no envio) ou o quadrado de iniciais. Tudo o que carrega é escapado. */
export function renderEmailLogoHtml(params: { readonly displayName: string; readonly logo: EmailLogo }): string {
  const { displayName, logo } = params
  if (logo.kind === 'cid') {
    return `<img src="cid:${escapeEmailHtml(logo.contentId)}" alt="${escapeEmailHtml(displayName)}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" style="display:block;border:0;width:${LOGO_SIZE}px;height:${LOGO_SIZE}px">`
  }
  const size = `${LOGO_SIZE}px`
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${LOGO_SIZE}" height="${LOGO_SIZE}"><tr><td align="center" valign="middle" width="${LOGO_SIZE}" height="${LOGO_SIZE}" style="width:${size};height:${size};background:${asphalt};color:${copper};font-family:${FONT};font-size:18px;font-weight:700">${escapeEmailHtml(buildInitials(displayName))}</td></tr></table>`
}

const HTTP_URL = /^https?:\/\//iu

function isHttpUrl(url: string | undefined): url is string {
  return url !== undefined && HTTP_URL.test(url)
}

/**
 * As marcas do rodapé: as imagens por URL absoluta (só `http(s)`; outra não vira `src`) e o texto, se houver.
 * Sem imagem e sem texto, vazio.
 */
export function renderEmailMarksHtml(params: {
  readonly platformMarkUrl?: string | undefined
  readonly productMarkUrl?: string | undefined
  readonly text?: string | undefined
}): string {
  const { platformMarkUrl, productMarkUrl, text } = params
  const productMark = isHttpUrl(productMarkUrl)
    ? `<img src="${escapeEmailHtml(productMarkUrl)}" alt="" height="28" style="display:block;margin:0 auto 8px;border:0;height:28px">`
    : ''
  const platformMark = isHttpUrl(platformMarkUrl)
    ? `<img src="${escapeEmailHtml(platformMarkUrl)}" alt="" height="12" style="vertical-align:middle;margin-right:6px;border:0;height:12px">`
    : ''
  const label =
    text === undefined || text === ''
      ? ''
      : `<span style="font-family:${FONT};font-size:11px;color:${slate}">${escapeEmailHtml(text)}</span>`
  return `${productMark}${platformMark}${label}`
}
