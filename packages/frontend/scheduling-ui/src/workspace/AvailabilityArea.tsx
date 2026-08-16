/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState } from 'react'
import { MAX_PAGE_SIZE } from '@adatechnology/scheduling-contracts'
import type { ResourceId } from '@adatechnology/scheduling-contracts'

import { AvailabilityEditor } from '../components/AvailabilityEditor'
import { useResources } from '../hooks/useResources.query'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

export function AvailabilityArea() {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const { data, isLoading, isError } = useResources({ active: true, pageSize: MAX_PAGE_SIZE })
  const [resourceId, setResourceId] = useState<ResourceId>('')

  const resources = data?.data ?? []
  const selectedResource = resources.find((resource) => resource.id === resourceId)

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col p-4 space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">{messages['agenda.resourceLabel']}</span>
        <select
          value={resourceId}
          onChange={(event) => setResourceId(event.target.value)}
          className="min-h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-sm"
        >
          <option value="">—</option>
          {resources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.name}
            </option>
          ))}
        </select>
      </label>

      {isError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {messages['common.loadFailure']}
        </p>
      )}

      {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">{messages['common.loading']}</p>}

      {selectedResource && (
        <AvailabilityEditor
          key={selectedResource.id}
          resourceId={selectedResource.id}
          timezone={selectedResource.timezone}
        />
      )}
    </div>
  )
}
