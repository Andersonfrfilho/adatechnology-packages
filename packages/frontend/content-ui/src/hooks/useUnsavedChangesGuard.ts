/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCallback, useEffect } from 'react'

/**
 * Protege o rascunho: fechar a aba com alteração pede confirmação do navegador, e `confirmLeave`
 * pergunta antes de uma navegação interna (botão Voltar do editor, troca de post).
 */
export function useUnsavedChangesGuard(isDirty: boolean, message: string): { readonly confirmLeave: () => boolean } {
  useEffect(() => {
    if (!isDirty) return undefined
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const confirmLeave = useCallback(() => !isDirty || window.confirm(message), [isDirty, message])
  return { confirmLeave }
}
