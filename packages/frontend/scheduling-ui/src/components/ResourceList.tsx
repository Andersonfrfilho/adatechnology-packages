/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Resource } from '@adatechnology/scheduling-contracts'

import { ROW_STRIPE, SURFACE_BORDER } from './ui.constant'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

export type ResourceListProps = {
  readonly resources: readonly Resource[]
  readonly onSelect: (resource: Resource) => void
}

export function ResourceList({ resources, onSelect }: ResourceListProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)

  if (resources.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{messages['common.empty']}</p>
  }

  return (
    <ul className={`${SURFACE_BORDER} divide-y divide-gray-200 overflow-hidden dark:divide-gray-800`}>
      {resources.map((resource, index) => (
        <li key={resource.id} className={index % 2 === 1 ? ROW_STRIPE : undefined}>
          <button
            type="button"
            onClick={() => onSelect(resource)}
            className="flex w-full items-center gap-3 px-4 py-3 min-h-11 text-left text-sm transition-colors hover:bg-brand-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:hover:bg-brand-900/20"
          >
            <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{resource.name}</span>
            <span className="text-gray-500 dark:text-gray-400">{messages[`resource.kind.${resource.kind}`]}</span>
            <span className="text-gray-500 dark:text-gray-400">{resource.timezone}</span>
            {!resource.active && (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {messages['resource.inactive']}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
