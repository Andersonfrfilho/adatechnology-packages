/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState } from 'react'

import { ServicePowerDialog } from './ServicePowerDialog.component'
import { INFRA_OPERATION_KIND, INFRA_SERVICE_POWER_STATE, type InfraOperationKind } from '../constants/infra.constant'
import { INFRA_FOCUS_RING } from '../constants/infraStyle.constant'
import { usePowerOffEnvironment, usePowerOnEnvironment } from '../hooks/infra.hook'
import { useInfraMessages } from '../providers'
import type { InfraEnvironment, InfraService } from '../types/infra.types'
import { canPowerService } from '../utils/environmentAction.util'
import { resolveInfraErrorMessage } from '../utils/infraError.util'

type ServicePowerButtonProps = {
  readonly environment: InfraEnvironment
  readonly service: InfraService
}

const BUTTON_CLASS = `rounded px-2 py-0.5 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300 ${INFRA_FOCUS_RING}`

function resolveKind(service: InfraService): InfraOperationKind {
  return service.powerState === INFRA_SERVICE_POWER_STATE.RUNNING
    ? INFRA_OPERATION_KIND.POWER_OFF
    : INFRA_OPERATION_KIND.POWER_ON
}

/** Liga ou desliga só este serviço. Sem `serviceId` na resposta da API ou durante outra operação, não desenha nada. */
export function ServicePowerButton({ environment, service }: ServicePowerButtonProps) {
  const infraLocale = useInfraMessages()
  const [isOpen, setIsOpen] = useState(false)
  const powerOff = usePowerOffEnvironment()
  const powerOn = usePowerOnEnvironment()

  if (!canPowerService({ environment, service })) return null

  const kind = resolveKind(service)
  const mutation = kind === INFRA_OPERATION_KIND.POWER_OFF ? powerOff : powerOn
  const errorMessage = mutation.isError ? resolveInfraErrorMessage(mutation.error, infraLocale) : undefined

  function handleClose() {
    setIsOpen(false)
    powerOff.reset()
    powerOn.reset()
  }

  function handleConfirm() {
    const params = { environmentId: environment.environmentId, serviceIds: [service.serviceId ?? ''] }
    mutation.mutate(params, { onSuccess: handleClose })
  }

  return (
    <>
      <button className={BUTTON_CLASS} onClick={() => setIsOpen(true)} type="button">
        {kind === INFRA_OPERATION_KIND.POWER_OFF ? infraLocale.power.serviceOff : infraLocale.power.serviceOn}
      </button>
      {isOpen ? (
        <ServicePowerDialog
          environmentName={environment.environmentName}
          errorMessage={errorMessage}
          isPending={mutation.isPending}
          kind={kind}
          onClose={handleClose}
          onConfirm={handleConfirm}
          service={service}
        />
      ) : null}
    </>
  )
}
