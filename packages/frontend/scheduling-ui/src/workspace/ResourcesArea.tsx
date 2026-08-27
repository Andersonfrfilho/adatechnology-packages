/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { MAX_PAGE_SIZE } from '@adatechnology/scheduling-contracts'
import type { CreateResourceInput, Resource, UpdateResourceInput } from '@adatechnology/scheduling-contracts'

import { ResourceForm } from '../components/ResourceForm'
import { ResourceList } from '../components/ResourceList'
import { SidePanel } from '../components/SidePanel'
import { EmptyState, ErrorBanner, ListSkeleton } from '../components/StateFeedback'
import { BUTTON_DANGER, BUTTON_PRIMARY } from '../components/ui.constant'
import { useCreateResource, useDeleteResource, useUpdateResource } from '../hooks/useResourceMutations.mutation'
import { useResources } from '../hooks/useResources.query'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

type ResourceDraft = Resource | null | undefined

export function ResourcesArea() {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const { data, isLoading, isError } = useResources({ pageSize: MAX_PAGE_SIZE })
  const createResource = useCreateResource()
  const updateResource = useUpdateResource()
  const deleteResource = useDeleteResource()

  const [draft, setDraft] = useState<ResourceDraft>(undefined)
  const isDraftOpen = draft !== undefined
  const isEditing = Boolean(draft)
  const resources = data?.data ?? []

  async function handleSubmit(input: CreateResourceInput & UpdateResourceInput): Promise<void> {
    try {
      if (draft) {
        await updateResource.mutateAsync({ id: draft.id, input })
      } else {
        await createResource.mutateAsync(input)
      }
      setDraft(undefined)
    } catch {
    }
  }

  function renderCreateButton() {
    return (
      <button type="button" onClick={() => setDraft(null)} className={BUTTON_PRIMARY}>
        <Plus aria-hidden="true" className="h-4 w-4" />
        {messages['resource.newResource']}
      </button>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <div className="flex flex-1 min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex justify-end">{renderCreateButton()}</div>

        {isError && <ErrorBanner message={messages['common.loadFailure']} />}

        {(createResource.isError || updateResource.isError || deleteResource.isError) && (
          <ErrorBanner message={messages['common.actionFailure']} />
        )}

        {isLoading && <ListSkeleton label={messages['common.loading']} />}

        {!isLoading && !isError && resources.length === 0 && (
          <EmptyState
            icon={Users}
            title={messages['resource.emptyTitle']}
            hint={messages['resource.emptyHint']}
            action={renderCreateButton()}
          />
        )}

        {!isLoading && resources.length > 0 && <ResourceList resources={resources} onSelect={setDraft} />}
      </div>

      {isDraftOpen && (
        <SidePanel
          title={isEditing ? messages['resource.editTitle'] : messages['resource.createTitle']}
          closeLabel={messages['common.close']}
          onClose={() => setDraft(undefined)}
          headerActions={
            isEditing ? (
              <button
                type="button"
                onClick={() => {
                  if (draft) void deleteResource.mutateAsync(draft.id).then(() => setDraft(undefined)).catch(() => {})
                }}
                className={BUTTON_DANGER}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {messages['common.remove']}
              </button>
            ) : undefined
          }
        >
          <ResourceForm
            key={draft ? draft.id : 'new'}
            {...(draft ? { initialValues: draft } : {})}
            onSubmit={handleSubmit}
          />
        </SidePanel>
      )}
    </div>
  )
}
