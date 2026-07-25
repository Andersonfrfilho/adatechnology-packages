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
