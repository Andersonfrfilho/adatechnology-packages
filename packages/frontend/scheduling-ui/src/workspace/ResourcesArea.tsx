/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { CreateResourceInput, Resource, UpdateResourceInput } from '@adatechnology/scheduling-contracts'

import { ResourceForm } from '../components/ResourceForm'
import { ResourceList } from '../components/ResourceList'
import { SidePanel } from '../components/SidePanel'
import { useCreateResource, useDeleteResource, useUpdateResource } from '../hooks/useResourceMutations.mutation'
import { useResources } from '../hooks/useResources.query'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

type ResourceDraft = Resource | null | undefined

const BUTTON_CLASS =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-11'
const BUTTON_PRIMARY = `${BUTTON_CLASS} bg-brand-600 text-white hover:bg-brand-700`
const BUTTON_DANGER = `${BUTTON_CLASS} text-red-700 hover:bg-red-50`

export function ResourcesArea() {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const { data, isLoading, isError } = useResources()
  const createResource = useCreateResource()
  const updateResource = useUpdateResource()
  const deleteResource = useDeleteResource()

  const [draft, setDraft] = useState<ResourceDraft>(undefined)
  const isDraftOpen = draft !== undefined
  const isEditing = Boolean(draft)

  async function handleSubmit(input: CreateResourceInput & UpdateResourceInput): Promise<void> {
    if (draft) {
      await updateResource.mutateAsync({ id: draft.id, input })
    } else {
      await createResource.mutateAsync(input)
    }
    setDraft(undefined)
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col p-4 space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setDraft(null)} className={`${BUTTON_PRIMARY} ml-auto`}>
          <Plus aria-hidden="true" className="w-4 h-4" />
          {messages['resource.newResource']}
        </button>
      </div>

      {isError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {messages['common.loadFailure']}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{messages['common.loading']}</p>
      ) : (
        <ResourceList resources={data?.data ?? []} onSelect={setDraft} />
      )}

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
                  if (draft) void deleteResource.mutateAsync(draft.id).then(() => setDraft(undefined))
                }}
                className={BUTTON_DANGER}
              >
                <Trash2 aria-hidden="true" className="w-4 h-4" />
                {messages['common.remove']}
              </button>
            ) : undefined
          }
        >
          <ResourceForm {...(draft ? { initialValues: draft } : {})} onSubmit={handleSubmit} />
        </SidePanel>
      )}
    </div>
  )
}
