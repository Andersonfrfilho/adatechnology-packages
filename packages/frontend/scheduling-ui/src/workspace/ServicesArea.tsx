/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Plus, Trash2, Wrench } from 'lucide-react'
import { useState } from 'react'
import { MAX_PAGE_SIZE } from '@adatechnology/scheduling-contracts'
import type { CreateServiceInput, Service, UpdateServiceInput } from '@adatechnology/scheduling-contracts'

import { ServiceForm } from '../components/ServiceForm'
import { ServiceList } from '../components/ServiceList'
import { SidePanel } from '../components/SidePanel'
import { EmptyState, ErrorBanner, ListSkeleton } from '../components/StateFeedback'
import { BUTTON_DANGER, BUTTON_PRIMARY } from '../components/ui.constant'
import { useCreateService, useDeleteService, useUpdateService } from '../hooks/useServiceMutations.mutation'
import { useServices } from '../hooks/useServices.query'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

type ServiceDraft = Service | null | undefined

export function ServicesArea() {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const { data, isLoading, isError } = useServices({ pageSize: MAX_PAGE_SIZE })
  const createService = useCreateService()
  const updateService = useUpdateService()
  const deleteService = useDeleteService()

  const [draft, setDraft] = useState<ServiceDraft>(undefined)
  const isDraftOpen = draft !== undefined
  const isEditing = Boolean(draft)
  const services = data?.data ?? []

  async function handleSubmit(input: CreateServiceInput & UpdateServiceInput): Promise<void> {
    try {
      if (draft) {
        await updateService.mutateAsync({ id: draft.id, input })
      } else {
        await createService.mutateAsync(input)
      }
      setDraft(undefined)
    } catch {
    }
  }

  function renderCreateButton() {
    return (
      <button type="button" onClick={() => setDraft(null)} className={BUTTON_PRIMARY}>
        <Plus aria-hidden="true" className="h-4 w-4" />
        {messages['service.newService']}
      </button>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <div className="flex flex-1 min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex justify-end">{renderCreateButton()}</div>

        {isError && <ErrorBanner message={messages['common.loadFailure']} />}

        {(createService.isError || updateService.isError || deleteService.isError) && (
          <ErrorBanner message={messages['common.actionFailure']} />
        )}

        {isLoading && <ListSkeleton label={messages['common.loading']} />}

        {!isLoading && !isError && services.length === 0 && (
          <EmptyState
            icon={Wrench}
            title={messages['service.emptyTitle']}
            hint={messages['service.emptyHint']}
            action={renderCreateButton()}
          />
        )}

        {!isLoading && services.length > 0 && <ServiceList services={services} onSelect={setDraft} />}
      </div>

      {isDraftOpen && (
        <SidePanel
          title={isEditing ? messages['service.editTitle'] : messages['service.createTitle']}
          closeLabel={messages['common.close']}
          onClose={() => setDraft(undefined)}
          headerActions={
            isEditing ? (
              <button
                type="button"
                onClick={() => {
                  if (draft) void deleteService.mutateAsync(draft.id).then(() => setDraft(undefined)).catch(() => {})
                }}
                className={BUTTON_DANGER}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {messages['common.remove']}
              </button>
            ) : undefined
          }
        >
          <ServiceForm
            key={draft ? draft.id : 'new'}
            {...(draft ? { initialValues: draft } : {})}
            onSubmit={handleSubmit}
          />
        </SidePanel>
      )}
    </div>
  )
}
