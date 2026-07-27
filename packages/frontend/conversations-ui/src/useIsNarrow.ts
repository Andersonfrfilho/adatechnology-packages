/**
 * Detecta tela estreita para decisões que CSS não resolve — como abrir ou não um painel por padrão.
 *
 * O breakpoint é o mesmo das classes `cv-only-*` e `.cv-back` (1024px). Duplicado aqui porque
 * JavaScript não lê media query do stylesheet; se um dia divergirem, o sintoma é painel abrindo
 * numa largura onde o resto da UI já mudou de modo.
 */

import { useEffect, useState } from 'react'

export const NARROW_MAX_WIDTH_PX = 1023

export function useIsNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${NARROW_MAX_WIDTH_PX}px)`).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${NARROW_MAX_WIDTH_PX}px)`)
    const handleChange = (event: MediaQueryListEvent): void => setIsNarrow(event.matches)

    query.addEventListener('change', handleChange)
    setIsNarrow(query.matches)

    return () => query.removeEventListener('change', handleChange)
  }, [])

  return isNarrow
}
