/**
 * Largura do próprio elemento, para decidir layout pelo espaço que ele tem — e não pelo tamanho da
 * janela.
 *
 * Os breakpoints do Tailwind (`sm:`, `lg:`) leem a janela, e é aí que erram nestas telas: abrir a
 * prévia do simulador, ou a lista de conversas ao lado, estreita a coluna sem a janela mudar de
 * tamanho. O layout continua achando que está no desktop e espreme o conteúdo flexível — o campo de
 * texto do composer e o nome do cliente no cabeçalho — para caber os botões, que não cedem.
 *
 * `undefined` enquanto não mediu (SSR e teste de markup incluídos): quem consome trata ausência de
 * medida como espaçoso, que é o layout completo.
 */

import { useEffect, useState, type RefObject } from 'react'

export function useContainerWidth(ref: RefObject<HTMLElement | null>): number | undefined {
  const [width, setWidth] = useState<number | undefined>(undefined)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return

    // Sempre a mesma medida nos dois caminhos: o `contentRect` do observer desconta o padding e o
    // `getBoundingClientRect` não. Misturar os dois desloca o limiar pela largura do padding — no
    // cabeçalho, 32px — e o layout decide uma coisa ao montar e outra ao redimensionar.
    const measure = () => setWidth(element.getBoundingClientRect().width)

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}
