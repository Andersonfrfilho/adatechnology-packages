/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState } from 'react'

export type AccountActionState = {
  readonly isRunning: boolean
  readonly error: string | undefined
  readonly isDone: boolean
  readonly run: (action: () => Promise<void>) => Promise<void>
}

/** Executa uma ação da conta guardando "rodando / erro / feito". O erro vira o texto do servidor, sem inventar outro. */
export function useAccountAction(): AccountActionState {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [isDone, setIsDone] = useState(false)

  async function run(action: () => Promise<void>): Promise<void> {
    setIsRunning(true)
    setError(undefined)
    setIsDone(false)
    try {
      await action()
      setIsDone(true)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setIsRunning(false)
    }
  }

  return { isRunning, error, isDone, run }
}
