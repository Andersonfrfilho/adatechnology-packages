/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Service } from '@adatechnology/scheduling-contracts'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

export type ServiceListProps = {
  readonly services: readonly Service[]
  readonly onSelect: (service: Service) => void
}

export function ServiceList({ services, onSelect }: ServiceListProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)

  if (services.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{messages['common.empty']}</p>
  }

  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
      {services.map((service, index) => (
        <li key={service.id} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/50' : undefined}>
          <button
            type="button"
            onClick={() => onSelect(service)}
            className="flex w-full items-center gap-3 px-4 py-3 min-h-11 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{service.name}</span>
            <span className="text-gray-500 dark:text-gray-400">{service.durationMinutes} min</span>
            {!service.active && (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {messages['service.inactive']}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
