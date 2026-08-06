/**
 * Aparência da barra de composição, compartilhada pelo `MessageComposer` e pelo
 * `RichMessageComposer`. São a mesma superfície na tela: divergir aqui é o que fazia a barra rica
 * aparecer branca sobre o fundo branco da página, com os atalhos flutuando sem faixa própria.
 */

/** Faixa cinza de largura cheia; o campo de texto dentro dela é que arredonda — ordem do WhatsApp. */
export const COMPOSER_BAR_CLASS = 'cv-composer-bar'

/** Botão redondo da barra: formatação, emoji, variáveis e anexo têm o mesmo peso visual. */
export const COMPOSER_TOOL_BUTTON_CLASS =
  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-900/30 dark:hover:text-teal-400'

/** Formatação em vigor no cursor. Sem isto o operador não sabe se o próximo caractere sai em negrito. */
export const COMPOSER_TOOL_BUTTON_ACTIVE_CLASS = 'bg-teal-50 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400'

export const COMPOSER_TOOL_BUTTON_IDLE_CLASS = 'text-gray-400 dark:text-gray-500'

/** Marcação do monoespaçado dentro do campo — a mesma que o `waToHTML` escreve, para o trecho não
 *  mudar de cara ao recarregar um rascunho. */
export const COMPOSER_MONOSPACE_CLASS = 'bg-black/5 dark:bg-white/10 rounded px-0.5 font-mono text-sm'

/**
 * Abaixo desta largura de barra (em px) os quatro botões de formatação recolhem num único botão com
 * popover. Com todos abertos, sobram ~200px de barra para os oito controles e o campo de texto fica
 * mais estreito que o próprio placeholder. É a largura da barra, não da janela: quem estreita a
 * coluna é a prévia do simulador ao lado, com a janela intacta.
 */
export const COMPOSER_COMPACT_WIDTH = 480

/** Atalho de resposta rápida: pílula branca, que só tem contraste porque a faixa é cinza. */
export const QUICK_REPLY_PILL_CLASS =
  'whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-teal-800 dark:hover:bg-teal-950/40 dark:hover:text-teal-400'
