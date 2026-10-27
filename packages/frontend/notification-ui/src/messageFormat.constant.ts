/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Formatação e emoji da caixa de mensagem.
 *
 * A marcação é a do WhatsApp — `*negrito*`, `_itálico_` — e ela é ÚNICA para todos os canais
 * (`conversation-flow.md` §4): quem escreve o fluxo escreve uma vez, e o canal que não entende a
 * convenção nativamente traduz na renderização. Um editor rico que cuspisse `<b>` obrigaria o texto
 * a existir duas vezes, e a segunda sempre atrasa em relação à primeira.
 *
 * Os delimitadores são simétricos de propósito: envolver a seleção e desfazer o envolvimento é a
 * mesma operação com o mesmo par, e é isso que deixa o botão alternar em vez de acumular asterisco.
 */

export const MESSAGE_FORMAT = {
  BOLD: 'bold',
  ITALIC: 'italic',
  STRIKETHROUGH: 'strikethrough',
  MONOSPACE: 'monospace',
} as const
export type MessageFormat = (typeof MESSAGE_FORMAT)[keyof typeof MESSAGE_FORMAT]

export type MessageFormatMark = {
  readonly format: MessageFormat
  readonly delimiter: string
}

export const MESSAGE_FORMAT_MARKS: readonly MessageFormatMark[] = [
  { format: MESSAGE_FORMAT.BOLD, delimiter: '*' },
  { format: MESSAGE_FORMAT.ITALIC, delimiter: '_' },
  { format: MESSAGE_FORMAT.STRIKETHROUGH, delimiter: '~' },
  { format: MESSAGE_FORMAT.MONOSPACE, delimiter: '```' },
]

/**
 * Paleta curada, e não um seletor com todos os emoji do Unicode.
 *
 * O mesmo emoji precisa significar a mesma coisa em todo o produto (`conversation-flow.md` §3), e
 * uma grade infinita garante o contrário: cada pessoa escolhe um símbolo diferente para "confirmar".
 * Vinte e quatro cobrem aviso, dinheiro, prazo e atendimento — o que estes produtos realmente dizem.
 */
export const MESSAGE_EMOJI: readonly string[] = [
  '✅',
  '❌',
  '⚠️',
  'ℹ️',
  '📅',
  '⏰',
  '⏳',
  '🔔',
  '💬',
  '📞',
  '📧',
  '🙋',
  '💰',
  '💳',
  '🧾',
  '📊',
  '📦',
  '🚚',
  '📍',
  '🔗',
  '🙂',
  '🎉',
  '🙏',
  '👋',
]
