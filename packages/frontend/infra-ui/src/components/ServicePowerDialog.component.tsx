/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useEffect, useId, useRef } from 'react'

import { INFRA_OPERATION_KIND, type InfraOperationKind } from '../constants/infra.constant'
import {
  INFRA_ALERT_ERROR,
  INFRA_BUTTON_DANGER,
  INFRA_BUTTON_PRIMARY,
  INFRA_BUTTON_SECONDARY,
} from '../constants/infraStyle.constant'
import { useInfraMessages } from '../providers'
import type { InfraService } from '../types/infra.types'
import { fillTemplate } from '../utils/zonedTime.util'

type ServicePowerDialogProps = {
  readonly environmentName: string
  readonly service: InfraService
  readonly kind: InfraOperationKind
  readonly isPending: boolean
  readonly errorMessage: string | undefined
  readonly onConfirm: () => void
  readonly onClose: () => void
}

/** Montado só enquanto aberto. Um serviço só: sem digitar o nome do ambiente, que é para o ambiente inteiro. */
export function ServicePowerDialog({
  environmentName,
  service,
  kind,
  isPending,
  errorMessage,
  onConfirm,
  onClose,
}: ServicePowerDialogProps) {
  const infraLocale = useInfraMessages()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const isPowerOff = kind === INFRA_OPERATION_KIND.POWER_OFF
  const values = { service: service.serviceName, environment: environmentName }

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault()
    if (!isPending) onConfirm()
  }

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-0 text-gray-900 backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      onClose={onClose}
      ref={dialogRef}
    >
      <form className="space-y-4 p-5" onSubmit={handleSubmit}>
        <header className="space-y-1">
          <h2 className="text-base font-semibold" id={titleId}>
            {fillTemplate({
              template: isPowerOff ? infraLocale.power.serviceTitleOff : infraLocale.power.serviceTitleOn,
              values,
            })}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300" id={descriptionId}>
            {fillTemplate({
              template: isPowerOff ? infraLocale.power.serviceDescriptionOff : infraLocale.power.serviceDescriptionOn,
              values,
            })}
          </p>
        </header>

        {isPowerOff && service.isDatabase ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">{infraLocale.power.serviceDatabaseWarning}</p>
        ) : null}

        {errorMessage ? (
          <p className={INFRA_ALERT_ERROR} role="alert">
            {errorMessage}
          </p>
        ) : null}

        <footer className="flex flex-wrap justify-end gap-2">
          <button className={INFRA_BUTTON_SECONDARY} onClick={onClose} type="button">
            {infraLocale.power.cancel}
          </button>
          <button
            className={isPowerOff ? INFRA_BUTTON_DANGER : INFRA_BUTTON_PRIMARY}
            disabled={isPending}
            type="submit"
          >
            {isPending
              ? infraLocale.power.pending
              : isPowerOff
                ? infraLocale.power.serviceConfirmOff
                : infraLocale.power.serviceConfirmOn}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
