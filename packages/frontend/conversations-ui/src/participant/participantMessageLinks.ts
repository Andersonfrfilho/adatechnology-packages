import type { InlineAtom } from './participantMessageFormat.types'

const ALLOWED_LINK_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const URL_PATTERN = /https?:\/\/[^\s<>`\u0000-\u001f]+/giu
const TRAILING_PUNCTUATION = '.,;:!?*_~\'"]}>'

export function isAllowedLinkHref(href: string): boolean {
  try {
    const url = new URL(href)
    return ALLOWED_LINK_PROTOCOLS.has(url.protocol) && url.username === '' && url.password === ''
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
  let openCount = countOf(raw, '(')
  let closeCount = countOf(raw, ')')
  let end = raw.length
  while (end > 0) {
    const last = raw.charAt(end - 1)
    if (last === ')' && closeCount > openCount) closeCount -= 1
    else if (!TRAILING_PUNCTUATION.includes(last)) break
    end -= 1
  }
  return raw.slice(0, end)
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
