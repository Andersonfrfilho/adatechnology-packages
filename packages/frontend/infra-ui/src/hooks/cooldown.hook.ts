/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useEffect, useState } from 'react'

type Cooldown = {
  readonly isCoolingDown: boolean
  readonly startCooldown: () => void
}

/** O limite de taxa do servidor nao expoe quanto falta; esperar um tempo fixo evita martelar a rota. */
export function useCooldown(durationMs: number): Cooldown {
  const [isCoolingDown, setIsCoolingDown] = useState(false)

  useEffect(() => {
    if (!isCoolingDown) return

    const timerId = setTimeout(() => setIsCoolingDown(false), durationMs)

    return () => clearTimeout(timerId)
  }, [isCoolingDown, durationMs])

  return { isCoolingDown, startCooldown: () => setIsCoolingDown(true) }
}
