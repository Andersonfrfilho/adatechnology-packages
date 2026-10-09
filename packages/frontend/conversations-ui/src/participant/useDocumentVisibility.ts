import { useEffect, useState } from 'react'

export function useDocumentVisibility(): DocumentVisibilityState {
  const [visibilityState, setVisibilityState] = useState<DocumentVisibilityState>(() =>
    typeof document === 'undefined' ? 'visible' : document.visibilityState,
  )

  useEffect(() => {
    function handleVisibilityChange(): void {
      setVisibilityState(document.visibilityState)
    }
    handleVisibilityChange()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return visibilityState
}
