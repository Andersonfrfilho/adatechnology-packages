/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

/**
 * Le no site a mesma marcacao que o WhatsApp le: `*negrito*` e `_italico_`.
 *
 * O texto do fluxo e escrito uma vez e sai nos dois canais. Sem esta traducao, quem escreve escolhe
 * entre negrito no WhatsApp ou asterisco literal no site — e o site perde, porque e a vitrine.
 *
 * **Nada aqui monta HTML.** O conteudo vem do editor de fluxo do painel e o widget roda embutido em
 * pagina de cliente: `innerHTML` transformaria o editor num vetor de injecao. O parser so devolve
 * texto e marcacao reconhecida, e a montagem usa `createElement` mais no de texto — entao um
 * `<script>` no meio da frase continua aparecendo como os caracteres que ele e.
 */
const MARKER_TAG = {
  '*': 'strong',
  _: 'em',
} as const

type Marker = keyof typeof MARKER_TAG

export type MarkupTag = (typeof MARKER_TAG)[Marker]

export type MarkupNode =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'marked'; readonly tag: MarkupTag; readonly children: readonly MarkupNode[] }

type MarkedSpan = {
  readonly start: number
  readonly end: number
  readonly tag: MarkupTag
  readonly content: string
}

const MARKERS = Object.keys(MARKER_TAG) as Marker[]

export function parseMarkup(text: string): readonly MarkupNode[] {
  const nodes: MarkupNode[] = []
  let cursor = 0

  while (cursor < text.length) {
    const span = findNextSpan(text, cursor)
    if (!span) break

    if (span.start > cursor) nodes.push({ type: 'text', value: text.slice(cursor, span.start) })
    nodes.push({ type: 'marked', tag: span.tag, children: parseMarkup(span.content) })
    cursor = span.end
  }

  if (cursor < text.length) nodes.push({ type: 'text', value: text.slice(cursor) })

  return nodes
}

export function buildFormattedFragment(text: string): DocumentFragment {
  return appendNodes(document.createDocumentFragment(), parseMarkup(text))
}

function appendNodes<TParent extends DocumentFragment | HTMLElement>(
  parent: TParent,
  nodes: readonly MarkupNode[],
): TParent {
  for (const node of nodes) {
    if (node.type === 'text') {
      parent.append(node.value)
      continue
    }

    parent.append(appendNodes(document.createElement(node.tag), node.children))
  }

  return parent
}

/**
 * Marcador so vale colado no conteudo, como no WhatsApp.
 *
 * `2 * 3 * 4` e multiplicacao, nao negrito; exigir caractere visivel logo depois da abertura e logo
 * antes do fechamento e o que separa um do outro sem precisar de lookbehind — que Safari antigo
 * ainda nao entende.
 */
function findNextSpan(text: string, from: number): MarkedSpan | undefined {
  for (let index = from; index < text.length; index++) {
    const marker = text[index]
    if (!isMarker(marker)) continue

    const closing = findClosingMarker(text, index, marker)
    if (closing === undefined) continue

    return {
      start: index,
      end: closing + 1,
      tag: MARKER_TAG[marker],
      content: text.slice(index + 1, closing),
    }
  }

  return undefined
}

function findClosingMarker(text: string, openingIndex: number, marker: Marker): number | undefined {
  if (isBlank(text[openingIndex + 1])) return undefined

  for (let index = openingIndex + 2; index < text.length; index++) {
    if (text[index] !== marker) continue
    if (isBlank(text[index - 1])) continue

    return index
  }

  return undefined
}

function isMarker(character: string | undefined): character is Marker {
  return character !== undefined && MARKERS.includes(character as Marker)
}

function isBlank(character: string | undefined): boolean {
  return character === undefined || character.trim().length === 0
}
