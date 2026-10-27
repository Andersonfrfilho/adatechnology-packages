import { findCopyableAtoms } from './participantMessageCopyables'
import type { InlineAtom } from './participantMessageFormat.types'
import { findLinkAtoms } from './participantMessageLinks'

const TRIPLE_FENCE = '```'

function spanAt(
  text: string,
  open: number,
): { readonly contentStart: number; readonly close: number; readonly width: number } | undefined {
  const isTriple = text.startsWith(TRIPLE_FENCE, open)
  const width = isTriple ? 3 : 1
  const close = text.indexOf(isTriple ? TRIPLE_FENCE : '`', open + width)
  if (close === -1) return undefined
  return { contentStart: open + width, close, width }
}

export function findCodeAtoms(text: string): InlineAtom[] {
  const atoms: InlineAtom[] = []
  let cursor = text.indexOf('`')
  while (cursor !== -1) {
    const span = spanAt(text, cursor)
    if (span === undefined) {
      if (!text.startsWith(TRIPLE_FENCE, cursor)) break
      cursor = text.indexOf('`', cursor + 3)
      continue
    }
    if (span.close === span.contentStart) {
      cursor = text.indexOf('`', cursor + span.width)
      continue
    }
    const end = span.close + span.width
    atoms.push({ start: cursor, end, node: { kind: 'code', value: text.slice(span.contentStart, span.close) } })
    cursor = text.indexOf('`', end)
  }
  return atoms
}

/** Code wins over links, links over copyable tokens; overlapping losers are dropped. */
export function findInlineAtoms(text: string): InlineAtom[] {
  const candidates = [...findCodeAtoms(text), ...findLinkAtoms(text), ...findCopyableAtoms(text)]
  const ordered = candidates
    .map((atom, rank) => ({ atom, rank }))
    .sort((a, b) => a.atom.start - b.atom.start || a.rank - b.rank)
  const accepted: InlineAtom[] = []
  let lastEnd = 0
  for (const { atom } of ordered) {
    if (atom.start < lastEnd) continue
    accepted.push(atom)
    lastEnd = atom.end
  }
  return accepted
}
