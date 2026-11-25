/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Lista de permissão, não de bloqueio: o que não for http(s), mailto, tel ou caminho relativo é
 * recusado. Bloquear só `javascript:` deixaria passar `vbscript:`, `data:` e o próximo esquema.
 */

const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])
const IMAGE_SCHEMES = new Set(['http', 'https'])
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i
// Navegador ignora tab, quebra de linha e controle dentro do esquema: `java\tscript:` executa.
// A checagem roda sobre a forma sem esses caracteres, que é a forma que o navegador enxerga.
const INVISIBLE_PATTERN = new RegExp(
  // eslint-disable-next-line no-control-regex -- casar caractere de controle é o objetivo
  '[\\u0000-\\u0020\\u007f-\\u009f\\u00ad\\u200b-\\u200f\\u2028\\u2029\\ufeff]+',
  'g',
)

function sanitize(url: string, allowedSchemes: ReadonlySet<string>): string | undefined {
  const normalized = url.replace(INVISIBLE_PATTERN, '')
  if (!normalized) return undefined
  const scheme = SCHEME_PATTERN.exec(normalized)?.[1]
  if (scheme === undefined) return normalized
  return allowedSchemes.has(scheme.toLowerCase()) ? normalized : undefined
}

/** `undefined` quando o destino não é seguro — o chamador renderiza só o texto do link. */
export function sanitizeLinkUrl(url: string): string | undefined {
  return sanitize(url, LINK_SCHEMES)
}

/** Imagem só por http(s) ou caminho relativo: `data:` permitiria SVG com script embutido. */
export function sanitizeImageUrl(url: string): string | undefined {
  return sanitize(url, IMAGE_SCHEMES)
}

export function isAbsoluteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith('//')
}
