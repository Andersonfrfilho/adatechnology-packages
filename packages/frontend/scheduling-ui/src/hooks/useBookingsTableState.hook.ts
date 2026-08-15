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

function readInitialState(): BookingsTableState {
  if (typeof window === 'undefined') return DEFAULT_BOOKINGS_TABLE_STATE
  return parseBookingsTableState(window.location.search)
}

export function useBookingsTableState() {
  const [state, setState] = useState<BookingsTableState>(readInitialState)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const query = serializeBookingsTableState(state)
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', url)
  }, [state])

  return [state, setState] as const
}
