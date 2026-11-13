/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState } from 'react'

import { Power, PowerOff } from 'lucide-react'

import { PowerConfirmDialog } from './PowerConfirmDialog.component'
import { canPowerOff, canPowerOn } from '../utils/environmentAction.util'
import { usePowerOffEnvironment, usePowerOnEnvironment } from '../hooks/infra.hook'
import { INFRA_OPERATION_KIND, type InfraOperationKind } from '../constants/infra.constant'
import { useInfraMessages } from '../providers'
import { resolveInfraErrorMessage } from '../utils/infraError.util'
import { INFRA_BUTTON_PRIMARY, INFRA_BUTTON_SECONDARY } from '../constants/infraStyle.constant'
import { isKeepOnUntilRequired } from '../utils/keepOnUntil.util'
import type { InfraEnvironment } from '../types/infra.types'

type PowerActionsProps = {
  readonly environment: InfraEnvironment
}

export function PowerActions({ environment }: PowerActionsProps) {
  const infraLocale = useInfraMessages()
  const [openKind, setOpenKind] = useState<InfraOperationKind | undefined>(undefined)
  const powerOff = usePowerOffEnvironment()
  const powerOn = usePowerOnEnvironment()

  const isPending = powerOff.isPending || powerOn.isPending
  const activeMutation = openKind === INFRA_OPERATION_KIND.POWER_OFF ? powerOff : powerOn
  const errorMessage = activeMutation.isError ? resolveInfraErrorMessage(activeMutation.error, infraLocale) : undefined
  const requiresKeepOnUntil = isKeepOnUntilRequired({ environment })

  function handleClose() {
    setOpenKind(undefined)
    powerOff.reset()
    powerOn.reset()
  }

  function handleConfirm(keepOnUntil: string | undefined) {
    const { environmentId } = environment
    const callbacks = { onSuccess: handleClose }

    if (openKind === INFRA_OPERATION_KIND.POWER_OFF) {
      powerOff.mutate({ environmentId }, callbacks)
      return
    }
    powerOn.mutate(keepOnUntil ? { environmentId, keepOnUntil } : { environmentId }, callbacks)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className={INFRA_BUTTON_PRIMARY}
        disabled={isPending || !canPowerOn(environment)}
        onClick={() => setOpenKind(INFRA_OPERATION_KIND.POWER_ON)}
        type="button"
      >
        <Power aria-hidden="true" className="size-4" />
        {infraLocale.power.on}
      </button>
      <button
        className={INFRA_BUTTON_SECONDARY}
        disabled={isPending || !canPowerOff(environment)}
        onClick={() => setOpenKind(INFRA_OPERATION_KIND.POWER_OFF)}
        type="button"
      >
        <PowerOff aria-hidden="true" className="size-4" />
        {infraLocale.power.off}
      </button>

      {openKind ? (
        <PowerConfirmDialog
          environmentName={environment.environmentName}
          errorMessage={errorMessage}
          isPending={isPending}
          kind={openKind}
          onClose={handleClose}
          onConfirm={handleConfirm}
          requiresKeepOnUntil={requiresKeepOnUntil}
          services={environment.services}
        />
      ) : null}
    </div>
  )
}
