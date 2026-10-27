/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Info } from 'lucide-react'

import { useInfraMessages } from '../providers'
import { CALENDAR_MONTH_WINDOW_SOURCE } from '../constants/infraUi.constant'
import type { InfraCosts } from '../types/infra.types'

type CostNoticesProps = {
  readonly costs: InfraCosts
}

export function CostNotices({ costs }: CostNoticesProps) {
  const infraLocale = useInfraMessages()
  const messages = [
    costs.isStale ? infraLocale.costs.stale : undefined,
    costs.windowSource === CALENDAR_MONTH_WINDOW_SOURCE ? infraLocale.costs.calendarMonth : undefined,
  ].filter((message): message is string => message !== undefined)

  if (messages.length === 0) return null

  return (
    <ul className="mb-4 space-y-2" role="status">
      {messages.map((message) => (
        <li
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          key={message}
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {message}
        </li>
      ))}
    </ul>
  )
}
