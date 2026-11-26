/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Endereço público do post: `<base>/<shortId>-<slug>`. O id curto é o que identifica o post; o slug é
 * só legibilidade. Trocar o título ou o slug não quebra link compartilhado: a leitura acha pelo id
 * curto, e o host redireciona (301) para o endereço canônico quando o pedido não for ele.
 */

export const SHORT_ID_LENGTH = 6
const SHORT_ID_PATTERN = /^[0-9a-z]{6}$/
const REF_PATTERN = /^([0-9a-z]{6})-(.+)$/

export function isShortId(value: string): boolean {
  return SHORT_ID_PATTERN.test(value)
}

/** `k3x9ab-novidades-fim-ano`. */
export function buildPostRef(params: { readonly shortId: string; readonly slug: string }): string {
  return `${params.shortId}-${params.slug}`
}

export function buildPostPath(params: {
  readonly basePath: string
  readonly shortId: string
  readonly slug: string
}): string {
  const base = params.basePath.replace(/\/+$/g, '')
  return `${base}/${encodeURIComponent(buildPostRef(params))}`
}

export type ParsedPostRef = {
  /** Candidato a id curto (os 6 primeiros caracteres antes do hífen), se o formato bate. */
  readonly shortId?: string
  /** O texto inteiro, como slug antigo (`/<base>/<slug>`). */
  readonly slug: string
}

/**
 * Lê o último trecho do endereço. Um slug antigo que por acaso comece com 6 caracteres e hífen também
 * parece `<id>-<slug>`; por isso a leitura tenta o id curto e, se nenhum post tiver esse id, cai no
 * texto inteiro como slug.
 */
export function parsePostRef(ref: string): ParsedPostRef {
  const slug = ref.trim().toLowerCase()
  const match = REF_PATTERN.exec(slug)
  return match?.[1] ? { shortId: match[1], slug } : { slug }
}

/** `/novidades/k3x9ab-titulo` com base `/novidades` → ref `k3x9ab-titulo`; `undefined` fora da base. */
export function parsePostPath(params: { readonly path: string; readonly basePath: string }): ParsedPostRef | undefined {
  const base = params.basePath.replace(/\/+$/g, '')
  const clean = params.path.split(/[?#]/)[0] ?? ''
  if (!clean.startsWith(`${base}/`)) return undefined
  const rest = clean.slice(base.length + 1).replace(/\/+$/g, '')
  if (!rest || rest.includes('/')) return undefined
  try {
    return parsePostRef(decodeURIComponent(rest))
  } catch {
    return undefined
  }
}

/** O pedido já é o endereço canônico? Se não, o host redireciona (301) para `buildPostRef`. */
export function isCanonicalPostRef(params: {
  readonly ref: string
  readonly shortId: string
  readonly slug: string
}): boolean {
  return params.ref.trim().toLowerCase() === buildPostRef(params)
}
