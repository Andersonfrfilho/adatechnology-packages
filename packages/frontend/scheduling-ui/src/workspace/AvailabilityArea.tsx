/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Clock } from 'lucide-react'
import { useState } from 'react'
import { MAX_PAGE_SIZE } from '@adatechnology/scheduling-contracts'
import type { ResourceId } from '@adatechnology/scheduling-contracts'

import { AvailabilityEditor } from '../components/AvailabilityEditor'
import { ResourceSelect } from '../components/ResourceSelect'
import { EmptyState, ErrorBanner, ListSkeleton } from '../components/StateFeedback'
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
    <div className="flex flex-1 min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4">
      <ResourceSelect
        label={messages['agenda.resourceLabel']}
        emptyOptionLabel={messages['availability.selectResourceTitle']}
        resources={resources}
        value={resourceId}
        onChange={setResourceId}
      />

      {isError && <ErrorBanner message={messages['common.loadFailure']} />}

      {isLoading && <ListSkeleton label={messages['common.loading']} rows={3} />}

      {!isLoading && !isError && !selectedResource && (
        <EmptyState
          icon={Clock}
          title={messages['availability.selectResourceTitle']}
          hint={messages['availability.selectResourceHint']}
        />
      )}

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
