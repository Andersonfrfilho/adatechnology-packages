/**
 * Estado e alternância da formatação dentro do campo rico.
 *
 * O botão precisa responder duas perguntas que o wrap manual não respondia: o cursor está dentro de
 * um negrito? e, se está, como saio dele? `execCommand` é depreciado mas continua sendo o único
 * caminho que alterna a formatação do cursor vazio — sem ele, ligar o negrito antes de digitar não
 * existe, e era por isso que os botões não pareciam acender nem apagar.
 *
 * `queryCommandState` responde pelo estilo computado, então acende igual para `<strong>` (nosso) e
 * `<b>` (do navegador). Onde o ambiente não tem as duas APIs — jsdom, teste — as funções avisam, e
 * quem chama volta ao wrap manual.
 */

import { COMPOSER_MONOSPACE_CLASS } from '../composer.constant'
import { ZERO_WIDTH_SPACE } from './whatsapp-formatting'

export const FORMATTING_ACTION = {
  BOLD: 'bold',
  ITALIC: 'italic',
  STRIKETHROUGH: 'strikethrough',
  MONOSPACE: 'monospace',
} as const
export type FormattingAction = (typeof FORMATTING_ACTION)[keyof typeof FORMATTING_ACTION]

/** Monoespaçado fica de fora: não existe comando nativo, o campo trata à mão. */
const EXEC_COMMAND_BY_ACTION = {
  [FORMATTING_ACTION.BOLD]: 'bold',
  [FORMATTING_ACTION.ITALIC]: 'italic',
  [FORMATTING_ACTION.STRIKETHROUGH]: 'strikeThrough',
} as const

/**
 * O conjunto ativo viaja como string separada para o React comparar por valor: um `Set` novo a cada
 * movimento do cursor rerenderizaria a barra inteira sem nada ter mudado.
 */
export const FORMATTING_SEPARATOR = '|'

interface EditorNodeParams {
  readonly node: Node
  readonly editor: HTMLElement
}

/** O `<code>` que envolve o cursor, se houver — a marcação de monoespaçado que damos ao texto. */
export function codeAncestorOf({ node, editor }: EditorNodeParams): HTMLElement | undefined {
  let current: Node | null = node

  while (current && current !== editor) {
    if (current instanceof HTMLElement && current.tagName === 'CODE') return current
    current = current.parentNode
  }

  return undefined
}

function canQueryCommandState(): boolean {
  return typeof document !== 'undefined' && typeof document.queryCommandState === 'function'
}

export function canExecuteFormattingCommand(): boolean {
  return typeof document !== 'undefined' && typeof document.execCommand === 'function'
}

function isCommandActive(command: string): boolean {
  if (!canQueryCommandState()) return false
  try {
    return document.queryCommandState(command)
  } catch {
    // Fora de um campo editável o navegador lança em vez de responder `false`.
    return false
  }
}

export function activeFormattingIn(editor: HTMLElement): string {
  const selection = typeof window !== 'undefined' ? window.getSelection() : null
  const anchor = selection?.anchorNode
  // Cursor fora do campo: nenhum botão aceso, senão a barra descreveria a seleção de outro lugar.
  if (!anchor || !editor.contains(anchor)) return ''

  const active: FormattingAction[] = []
  for (const [action, command] of Object.entries(EXEC_COMMAND_BY_ACTION)) {
    if (isCommandActive(command)) active.push(action as FormattingAction)
  }
  if (codeAncestorOf({ node: anchor, editor })) active.push(FORMATTING_ACTION.MONOSPACE)

  return active.join(FORMATTING_SEPARATOR)
}

export function isFormattingActive({ active, action }: { active: string; action: FormattingAction }): boolean {
  return active.split(FORMATTING_SEPARATOR).includes(action)
}

/**
 * Liga o monoespaçado no cursor vago: abre o `<code>` e põe o cursor lá dentro, ancorado no espaço
 * de largura zero — sem a âncora não há onde o cursor pousar, e o próximo caractere sai de fora.
 * A âncora some na conversão para a notação do WhatsApp.
 */
export function startMonospaceAt(range: Range): void {
  const code = document.createElement('code')
  code.className = COMPOSER_MONOSPACE_CLASS
  code.textContent = ZERO_WIDTH_SPACE
  range.deleteContents()
  range.insertNode(code)
  placeCaretAfter(code.firstChild as Text, ZERO_WIDTH_SPACE.length)
}

/**
 * Desliga o monoespaçado do cursor vago. Só mover o cursor para depois do `</code>` não basta — o
 * navegador o traz de volta para dentro; é preciso uma âncora do lado de fora para ele pousar.
 */
export function exitMonospaceAfter(code: HTMLElement): void {
  const anchor = document.createTextNode(ZERO_WIDTH_SPACE)
  code.after(anchor)
  placeCaretAfter(anchor, ZERO_WIDTH_SPACE.length)
}

/** Tira a marcação e devolve o texto ao redor — o que o clique com seleção dentro do código faz. */
export function unwrapMonospace(code: HTMLElement): void {
  code.replaceWith(document.createTextNode(code.textContent?.replace(ZERO_WIDTH_SPACE, '') ?? ''))
}

function placeCaretAfter(node: Text, offset: number): void {
  const caret = document.createRange()
  caret.setStart(node, offset)
  caret.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(caret)
}

/**
 * Alterna a formatação pelo navegador. Devolve `false` quando o comando não existe no ambiente,
 * para o campo cair no wrap manual em vez de engolir o clique.
 */
export function toggleFormattingCommand(action: FormattingAction): boolean {
  const command = EXEC_COMMAND_BY_ACTION[action as keyof typeof EXEC_COMMAND_BY_ACTION]
  if (!command || !canExecuteFormattingCommand()) return false

  try {
    // Sem isto o Chrome escreve `<span style="font-weight:bold">`, que não sobrevive ao htmlToWA.
    document.execCommand('styleWithCSS', false, 'false')
    return document.execCommand(command)
  } catch {
    return false
  }
}
