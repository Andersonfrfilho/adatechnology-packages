import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'conversations-ui-dark-mode'

function getInitialDark(): boolean {
  if (typeof window === 'undefined') return false

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored !== null) {
    return stored === 'true'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Leitura passiva do tema do host: observa a classe `dark` no `<html>` e não escreve nada.
 *
 * Existe porque `useDarkMode` é um controlador — ele grava a classe e persiste a preferência. Um
 * componente que só precisa escolher cor não pode usá-lo: bastava renderizar o mapa de fluxos
 * para o app inteiro do host trocar de tema, seguindo o `prefers-color-scheme` do sistema em vez
 * da configuração da aplicação.
 */
export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => setIsDark(root.classList.contains('dark')))

    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    setIsDark(root.classList.contains('dark'))

    return () => observer.disconnect()
  }, [])

  return isDark
}

export function useDarkMode(): { isDark: boolean; toggle: () => void } {
  const [isDark, setIsDark] = useState(getInitialDark)

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(STORAGE_KEY, String(isDark))
  }, [isDark])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (event: MediaQueryListEvent) => {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === null) {
        setIsDark(event.matches)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const toggle = useCallback(() => {
    setIsDark((prev) => !prev)
  }, [])

  return { isDark, toggle }
}
