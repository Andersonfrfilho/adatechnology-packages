/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useEffect, useState } from 'react'

export const SEARCH_DEBOUNCE_MS = 250

export function useDebouncedValue<TValue>(value: TValue, delayMs = SEARCH_DEBOUNCE_MS): TValue {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
