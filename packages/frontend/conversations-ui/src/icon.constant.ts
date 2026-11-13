/**
 * Tamanhos de ícone da UI de conversas, em px, na escala de 4 da grade.
 *
 * Ícone vem da biblioteca (lucide), nunca emoji. Emoji desenha diferente em cada sistema
 * operacional, não herda `currentColor` — então não acompanha o estado do controle (ativo,
 * desabilitado, variante destrutiva) — e não escala com o token de tipografia. Numa mesma faixa,
 * metade emoji e metade SVG lê como duas famílias de botão.
 */

export const ICON_SIZE_PILL = 12
export const ICON_SIZE_INLINE = 14
export const ICON_SIZE_ACTION = 16
