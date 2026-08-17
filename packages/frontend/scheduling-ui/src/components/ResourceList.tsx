/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Resource } from '@adatechnology/scheduling-contracts'

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
    <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
      {resources.map((resource, index) => (
        <li key={resource.id} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/50' : undefined}>
          <button
            type="button"
            onClick={() => onSelect(resource)}
            className="flex w-full items-center gap-3 px-4 py-3 min-h-11 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{resource.name}</span>
            <span className="text-gray-500 dark:text-gray-400">{messages[`resource.kind.${resource.kind}`]}</span>
            <span className="text-gray-500 dark:text-gray-400">{resource.timezone}</span>
            {!resource.active && (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {messages['resource.inactive']}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
