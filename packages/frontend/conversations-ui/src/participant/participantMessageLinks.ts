import type { InlineAtom } from './participantMessageFormat.types'

const ALLOWED_LINK_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const URL_PATTERN = /https?:\/\/[^\s<>`\u0000-\u001f]+/giu
const TRAILING_PUNCTUATION = '.,;:!?*_~\'"]}>'

export function isAllowedLinkHref(href: string): boolean {
  try {
    return ALLOWED_LINK_PROTOCOLS.has(new URL(href).protocol)
  } catch {
    return false
  }
}

function isAlphanumeric(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}]/u.test(character)
}

function countOf(text: string, character: string): number {
  let count = 0
  for (const current of text) if (current === character) count += 1
  return count
}

function trimUrl(raw: string): string {
  let url = raw
  for (;;) {
    const last = url.slice(-1)
    const hasUnbalancedParenthesis = last === ')' && countOf(url, ')') > countOf(url, '(')
    if (!hasUnbalancedParenthesis && !TRAILING_PUNCTUATION.includes(last)) return url
    url = url.slice(0, -1)
  }
}

function toLinkAtom(text: string, start: number, raw: string): InlineAtom | undefined {
  const label = trimUrl(raw)
  if (/^https?:\/\/$/i.test(label) || isAlphanumeric(text[start - 1])) return undefined
  const href = label.replace(/^https?/i, (scheme) => scheme.toLowerCase())
  if (!isAllowedLinkHref(href)) return undefined
  return { start, end: start + label.length, node: { kind: 'link', href, label } }
}

export function findLinkAtoms(text: string): InlineAtom[] {
  const atoms: InlineAtom[] = []
  for (const match of text.matchAll(URL_PATTERN)) {
    const atom = toLinkAtom(text, match.index, match[0])
    if (atom) atoms.push(atom)
  }
  return atoms
}
