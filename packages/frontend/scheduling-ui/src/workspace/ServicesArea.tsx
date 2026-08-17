/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { CreateServiceInput, Service, UpdateServiceInput } from '@adatechnology/scheduling-contracts'

import { ServiceForm } from '../components/ServiceForm'
import { ServiceList } from '../components/ServiceList'
import { SidePanel } from '../components/SidePanel'
import { useCreateService, useDeleteService, useUpdateService } from '../hooks/useServiceMutations.mutation'
import { useServices } from '../hooks/useServices.query'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

type ServiceDraft = Service | null | undefined

const BUTTON_CLASS =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-11'
const BUTTON_PRIMARY = `${BUTTON_CLASS} bg-brand-600 text-white hover:bg-brand-700`
const BUTTON_DANGER = `${BUTTON_CLASS} text-red-700 hover:bg-red-50`

export function ServicesArea() {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const { data, isLoading, isError } = useServices()
  const createService = useCreateService()
  const updateService = useUpdateService()
  const deleteService = useDeleteService()

  const [draft, setDraft] = useState<ServiceDraft>(undefined)
  const isDraftOpen = draft !== undefined
  const isEditing = Boolean(draft)

  async function handleSubmit(input: CreateServiceInput & UpdateServiceInput): Promise<void> {
    try {
      if (draft) {
        await updateService.mutateAsync({ id: draft.id, input })
      } else {
        await createService.mutateAsync(input)
      }
      setDraft(undefined)
    } catch {
      // H-G: painel fica aberto e o alerta abaixo (isError) mostra a falha — sem isto a rejeição
      // sobe sem tratamento até o `onSubmit` do form, que não tem `.catch()`.
    }
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col p-4 space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setDraft(null)} className={`${BUTTON_PRIMARY} ml-auto`}>
          <Plus aria-hidden="true" className="w-4 h-4" />
          {messages['service.newService']}
        </button>
      </div>

      {isError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {messages['common.loadFailure']}
        </p>
      )}

      {(createService.isError || updateService.isError || deleteService.isError) && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {messages['common.actionFailure']}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{messages['common.loading']}</p>
      ) : (
        <ServiceList services={data?.data ?? []} onSelect={setDraft} />
      )}

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
                  // H-G: `.catch()` obrigatório — sem ele, uma falha de exclusão vira rejeição não
                  // tratada; o alerta acima (deleteService.isError) já mostra a falha ao usuário.
                  if (draft) void deleteService.mutateAsync(draft.id).then(() => setDraft(undefined)).catch(() => {})
                }}
                className={BUTTON_DANGER}
              >
                <Trash2 aria-hidden="true" className="w-4 h-4" />
                {messages['common.remove']}
              </button>
            ) : undefined
          }
        >
          {/* H-6: sem `key`, trocar de serviço selecionado sem fechar o painel mantém o `useState`
              interno do form com os valores do serviço anterior — ver `AvailabilityArea.tsx`. */}
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
