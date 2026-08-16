/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState } from 'react'
import type { BookingId } from '@adatechnology/scheduling-contracts'

import { BookingDrawer } from '../components/BookingDrawer'
import { BookingsTable } from '../components/BookingsTable'
import { useConfirmBooking } from '../hooks/useBookingMutations.mutation'
import { useBookings } from '../hooks/useBookings.query'
import { useBookingsTableState } from '../hooks/useBookingsTableState.hook'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

const PAGE_SIZE = 20

export function BookingsArea() {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const [tableState, setTableState] = useBookingsTableState()
  // H-F: `ListBookingsParams.status` aceita array — o servidor filtra por todos os selecionados
  // (`inArray`), então a paginação (`data.totalPages`) já reflete o total pós-filtro.
  const status = tableState.statusFilters.length > 0 ? tableState.statusFilters : undefined
  const { data, isLoading, isError } = useBookings({
    page: tableState.page,
    pageSize: PAGE_SIZE,
    status,
    sortBy: tableState.sortColumn,
    sortDirection: tableState.sortColumn ? tableState.sortDirection : undefined,
  })
  const confirmBooking = useConfirmBooking()

  const [selectedBookingId, setSelectedBookingId] = useState<BookingId | undefined>(undefined)
  const selectedBooking = data?.data.find((booking) => booking.id === selectedBookingId)

  function bulkConfirm(ids: readonly string[]): void {
    for (const id of ids) confirmBooking.mutate(id)
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col p-4 space-y-4">
      {isError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {messages['common.loadFailure']}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{messages['common.loading']}</p>
      ) : (
        <BookingsTable
          bookings={data?.data ?? []}
          state={tableState}
          onStateChange={setTableState}
          pagination={data ? { totalPages: data.totalPages } : undefined}
          onRowClick={(booking) => setSelectedBookingId(booking.id)}
          bulkActions={[{ key: 'confirm', label: messages['booking.confirm'], onRun: bulkConfirm }]}
        />
      )}

      {selectedBooking && (
        <BookingDrawer booking={selectedBooking} onClose={() => setSelectedBookingId(undefined)} />
      )}
    </div>
  )
}
