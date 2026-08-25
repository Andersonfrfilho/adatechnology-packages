/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Realce de HTML como DADOS, nunca como string de markup.
 *
 * A tentação aqui é montar `<span class=...>` numa string e jogar em `dangerouslySetInnerHTML` —
 * é o caminho mais curto e é como quase toda biblioteca de realce faz. Num editor esse caminho
 * passa por cima do texto que a pessoa acabou de digitar: o realce vira o vetor de injeção do
 * próprio conteúdo que ele deveria só colorir. Devolver tokens deixa o React criar nó de texto, e
 * a questão simplesmente não existe.
 */

export const HTML_TOKEN = {
  TAG: 'tag',
  NAME: 'name',
  ATTRIBUTE: 'attribute',
  VALUE: 'value',
  COMMENT: 'comment',
  DOCTYPE: 'doctype',
  VARIABLE: 'variable',
  TEXT: 'text',
} as const
export type HtmlTokenKind = (typeof HTML_TOKEN)[keyof typeof HTML_TOKEN]

export type HtmlToken = {
  readonly kind: HtmlTokenKind
  readonly text: string
}

/**
 * Um scanner, não um parser: ele não monta árvore nem valida aninhamento — quem reclama de tag
 * desbalanceada é o `validateEmailHtml`. Aqui só interessa onde começa e termina cada pedaço, e
 * um scanner erra de forma inofensiva (colore de menos), enquanto um parser meia-boca erra
 * escondendo texto.
 */
const SCANNER =
  /(<!--[\s\S]*?-->)|(<!doctype[^>]*>)|(<\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?>)|(\{\{\s*[\w.]+\s*\}\})/gi

export function tokenizeHtml(source: string): readonly HtmlToken[] {
  const tokens: HtmlToken[] = []
  let cursor = 0

  for (const match of source.matchAll(SCANNER)) {
    const start = match.index
    if (start > cursor) push(tokens, HTML_TOKEN.TEXT, source.slice(cursor, start))

    const [whole, comment, doctype, open, name, attributes, close, variable] = match

    if (comment) push(tokens, HTML_TOKEN.COMMENT, comment)
    else if (doctype) push(tokens, HTML_TOKEN.DOCTYPE, doctype)
    else if (variable) push(tokens, HTML_TOKEN.VARIABLE, variable)
    else if (name) {
      push(tokens, HTML_TOKEN.TAG, open ?? '<')
      push(tokens, HTML_TOKEN.NAME, name)
      tokens.push(...tokenizeAttributes(attributes ?? ''))
      push(tokens, HTML_TOKEN.TAG, close ?? '>')
    }

    cursor = start + whole.length
  }

  if (cursor < source.length) push(tokens, HTML_TOKEN.TEXT, source.slice(cursor))
  return tokens
}

const ATTRIBUTE_SCANNER = /([\w:@.-]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)?/g

function tokenizeAttributes(source: string): readonly HtmlToken[] {
  const tokens: HtmlToken[] = []
  let cursor = 0

  for (const match of source.matchAll(ATTRIBUTE_SCANNER)) {
    const start = match.index
    if (start > cursor) push(tokens, HTML_TOKEN.TEXT, source.slice(cursor, start))

    const [whole, attribute, equals, value] = match
    push(tokens, HTML_TOKEN.ATTRIBUTE, attribute ?? '')
    push(tokens, HTML_TOKEN.TEXT, equals ?? '')
    push(tokens, HTML_TOKEN.VALUE, value ?? '')

    cursor = start + whole.length
  }

  if (cursor < source.length) push(tokens, HTML_TOKEN.TEXT, source.slice(cursor))
  return tokens
}

function push(tokens: HtmlToken[], kind: HtmlTokenKind, text: string): void {
  if (text) tokens.push({ kind, text })
}
