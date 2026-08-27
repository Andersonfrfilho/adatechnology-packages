/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { MAX_PAGE_SIZE } from '@adatechnology/scheduling-contracts'
import type { BookingId } from '@adatechnology/scheduling-contracts'

import { BookingDrawer } from '../components/BookingDrawer'
import { BookingsTable } from '../components/BookingsTable'
import { EmptyState, ErrorBanner, ListSkeleton } from '../components/StateFeedback'
import { useConfirmBooking } from '../hooks/useBookingMutations.mutation'
import { useBookings } from '../hooks/useBookings.query'
import { useBookingsTableState } from '../hooks/useBookingsTableState.hook'
import { useResources } from '../hooks/useResources.query'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

const PAGE_SIZE = 20

export function BookingsArea() {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const [tableState, setTableState] = useBookingsTableState()
  const status = tableState.statusFilters.length > 0 ? tableState.statusFilters : undefined
  const { data, isLoading, isError } = useBookings({
    page: tableState.page,
    pageSize: PAGE_SIZE,
    status,
    sortBy: tableState.sortColumn,
    sortDirection: tableState.sortColumn ? tableState.sortDirection : undefined,
  })
  const confirmBooking = useConfirmBooking()
  const { data: resourcesData } = useResources({ pageSize: MAX_PAGE_SIZE })

  const [selectedBookingId, setSelectedBookingId] = useState<BookingId | undefined>(undefined)
  const selectedBooking = data?.data.find((booking) => booking.id === selectedBookingId)
  const selectedBookingResourceTimezone = resourcesData?.data.find(
    (resource) => resource.id === selectedBooking?.resourceIds[0],
  )?.timezone

  function bulkConfirm(ids: readonly string[]): void {
    for (const id of ids) confirmBooking.mutate(id)
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <div className="flex flex-1 min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4">
        {isError && <ErrorBanner message={messages['common.loadFailure']} />}

        {confirmBooking.isError && <ErrorBanner message={messages['common.actionFailure']} />}

        {isLoading && <ListSkeleton label={messages['common.loading']} rows={8} />}

        {!isLoading && !isError && (data?.data.length ?? 0) === 0 && tableState.statusFilters.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title={messages['booking.emptyTitle']}
            hint={messages['booking.emptyHint']}
          />
        )}

        {!isLoading && ((data?.data.length ?? 0) > 0 || tableState.statusFilters.length > 0) && (
          <BookingsTable
            bookings={data?.data ?? []}
            state={tableState}
            onStateChange={setTableState}
            pagination={data ? { totalPages: data.totalPages } : undefined}
            onRowClick={(booking) => setSelectedBookingId(booking.id)}
            bulkActions={[{ key: 'confirm', label: messages['booking.confirm'], onRun: bulkConfirm }]}
          />
        )}
      </div>

      {selectedBooking && (
        <BookingDrawer
          key={selectedBooking.id}
          booking={selectedBooking}
          resourceTimezone={selectedBookingResourceTimezone}
          onClose={() => setSelectedBookingId(undefined)}
        />
      )}
    </div>
  )
}
