import { findInlineAtoms } from './participantMessageAtoms'
import type { InlineAtom, InlineNode } from './participantMessageFormat.types'

type MarkKind = 'strong' | 'em' | 'del'

const MARKS: Readonly<Record<string, MarkKind>> = { '*': 'strong', _: 'em', '~': 'del' }

type LineContext = {
  readonly text: string
  readonly atomAt: ReadonlyMap<number, InlineAtom>
  readonly isMasked: readonly boolean[]
  readonly closers: Readonly<Record<string, readonly number[]>>
}

function isWord(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}]/u.test(character)
}

function isSpace(character: string | undefined): boolean {
  return character === undefined || /\s/u.test(character)
}

function characterBefore(text: string, index: number): string | undefined {
  if (index <= 0) return undefined
  const code = text.charCodeAt(index - 1)
  const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff
  if (isLowSurrogate && index >= 2) return String.fromCodePoint(text.codePointAt(index - 2) ?? code)
  return text.charAt(index - 1)
}

function buildContext(text: string): LineContext {
  const atoms = findInlineAtoms(text)
  const isMasked: boolean[] = new Array<boolean>(text.length).fill(false)
  for (const atom of atoms) isMasked.fill(true, atom.start, atom.end)
  const closers: Record<string, number[]> = { '*': [], _: [], '~': [] }
  for (let index = 1; index < text.length; index += 1) {
    const character = text.charAt(index)
    const list = closers[character]
    const isCloser = list !== undefined && !isMasked[index] && !isSpace(text[index - 1]) && !isWord(text[index + 1])
    if (isCloser) list.push(index)
  }
  return { text, atomAt: new Map(atoms.map((atom) => [atom.start, atom])), isMasked, closers }
}

function isOpener(context: LineContext, index: number): boolean {
  const { text } = context
  const next = text[index + 1]
  if (context.isMasked[index] || next === undefined || isSpace(next) || next === text[index]) return false
  return !isWord(characterBefore(text, index))
}

function findCloser(context: LineContext, mark: string, from: number, limit: number): number | undefined {
  const list = context.closers[mark] ?? []
  let low = 0
  let high = list.length
  while (low < high) {
    const middle = (low + high) >> 1
    if ((list[middle] ?? 0) < from) low = middle + 1
    else high = middle
  }
  const found = list[low]
  return found !== undefined && found < limit ? found : undefined
}

function parseRange(context: LineContext, start: number, end: number): InlineNode[] {
  const nodes: InlineNode[] = []
  let textStart = start
  let index = start
  const flush = (until: number): void => {
    if (until > textStart) nodes.push({ kind: 'text', value: context.text.slice(textStart, until) })
  }
  while (index < end) {
    const atom = context.atomAt.get(index)
    const mark = MARKS[context.text.charAt(index)]
    const closer =
      mark !== undefined && !atom && isOpener(context, index)
        ? findCloser(context, context.text.charAt(index), index + 2, end)
        : undefined
    if (atom) {
      flush(index)
      nodes.push(atom.node)
      index = atom.end
    } else if (mark !== undefined && closer !== undefined) {
      flush(index)
      nodes.push({ kind: mark, children: parseRange(context, index + 1, closer) })
      index = closer + 1
    } else {
      index += 1
      continue
    }
    textStart = index
  }
  flush(end)
  return nodes
}

export function parseInline(line: string): InlineNode[] {
  return parseRange(buildContext(line), 0, line.length)
}
