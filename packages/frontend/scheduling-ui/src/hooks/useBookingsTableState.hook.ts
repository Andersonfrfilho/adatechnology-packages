/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useEffect, useState } from 'react'

import {
  DEFAULT_BOOKINGS_TABLE_STATE,
  parseBookingsTableState,
  serializeBookingsTableState,
} from '../components/bookingsTableState.util'
import type { BookingsTableState } from '../components/bookingsTableState.util'

// H-D: as únicas chaves que este hook possui na URL — qualquer outra (`area`, `filial`, etc., do
// host) precisa sobreviver ao `replaceState`, que antes reconstruía a URL só a partir do que
// `serializeBookingsTableState` conhecia e descartava o resto.
const OWNED_PARAM_KEYS = ['sortBy', 'sortDirection', 'status', 'page']

function readInitialState(): BookingsTableState {
  if (typeof window === 'undefined') return DEFAULT_BOOKINGS_TABLE_STATE
  return parseBookingsTableState(window.location.search)
}

export function useBookingsTableState() {
  const [state, setState] = useState<BookingsTableState>(readInitialState)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    for (const key of OWNED_PARAM_KEYS) params.delete(key)
    for (const [key, value] of new URLSearchParams(serializeBookingsTableState(state))) params.append(key, value)
    const query = params.toString()
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState(window.history.state, '', url)
  }, [state])

  return [state, setState] as const
}
