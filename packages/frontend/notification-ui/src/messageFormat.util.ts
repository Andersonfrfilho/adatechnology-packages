/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type ApplyMarkParams = {
  readonly text: string
  readonly delimiter: string
  readonly selectionStart: number
  readonly selectionEnd: number
}

export type ApplyMarkResult = {
  readonly text: string
  /** Onde o cursor precisa ficar depois — sem isto, ele volta para o começo a cada clique. */
  readonly selectionStart: number
  readonly selectionEnd: number
}

/**
 * Envolve a seleção com o delimitador — ou DESFAZ, se ela já estiver envolvida.
 *
 * O botão alterna, e não acumula: clicar duas vezes em negrito com o mesmo trecho selecionado
 * devolve o texto original. Sem isso, `**texto**` vira literal na conversa, porque a convenção do
 * WhatsApp não aninha — o segundo par cancela o primeiro e o cliente mostra os asteriscos.
 *
 * Seleção vazia insere o par e põe o cursor no meio: é o comportamento de quem clica em negrito
 * ANTES de escrever, que é metade das vezes.
 */
export function applyMark({ text, delimiter, selectionStart, selectionEnd }: ApplyMarkParams): ApplyMarkResult {
  const start = clamp(selectionStart, text.length)
  const end = clamp(Math.max(selectionEnd, selectionStart), text.length)

  const selected = text.slice(start, end)
  const size = delimiter.length

  const wrappedInside = selected.startsWith(delimiter) && selected.endsWith(delimiter) && selected.length > size * 2
  if (wrappedInside) {
    const bare = selected.slice(size, -size)
    return {
      text: `${text.slice(0, start)}${bare}${text.slice(end)}`,
      selectionStart: start,
      selectionEnd: start + bare.length,
    }
  }

  const wrappedOutside = text.slice(start - size, start) === delimiter && text.slice(end, end + size) === delimiter
  if (wrappedOutside) {
    return {
      text: `${text.slice(0, start - size)}${selected}${text.slice(end + size)}`,
      selectionStart: start - size,
      selectionEnd: start - size + selected.length,
    }
  }

  return {
    text: `${text.slice(0, start)}${delimiter}${selected}${delimiter}${text.slice(end)}`,
    selectionStart: start + size,
    selectionEnd: start + size + selected.length,
  }
}

/** Insere no cursor, substituindo o que estiver selecionado — o que todo campo de texto faz. */
export function insertAt({
  text,
  insertion,
  selectionStart,
  selectionEnd,
}: {
  readonly text: string
  readonly insertion: string
  readonly selectionStart: number
  readonly selectionEnd: number
}): ApplyMarkResult {
  const start = clamp(selectionStart, text.length)
  const end = clamp(Math.max(selectionEnd, selectionStart), text.length)
  const next = start + insertion.length

  return {
    text: `${text.slice(0, start)}${insertion}${text.slice(end)}`,
    selectionStart: next,
    selectionEnd: next,
  }
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max)
}
