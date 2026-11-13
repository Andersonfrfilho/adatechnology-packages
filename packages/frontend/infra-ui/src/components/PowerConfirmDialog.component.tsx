/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import { Database } from 'lucide-react'

import { KeepOnUntilPicker } from './KeepOnUntilPicker.component'
import { listServicesToStop, matchesEnvironmentName } from '../utils/environmentAction.util'
import { INFRA_OPERATION_KIND, type InfraOperationKind } from '../constants/infra.constant'
import { useInfraMessages } from '../providers'
import {
  INFRA_ALERT_ERROR,
  INFRA_BUTTON_DANGER,
  INFRA_BUTTON_PRIMARY,
  INFRA_BUTTON_SECONDARY,
  INFRA_FIELD,
  INFRA_LABEL,
} from '../constants/infraStyle.constant'
import { DEFAULT_KEEP_ON_OPTION_ID, type KeepOnOptionId } from '../constants/infraUi.constant'
import { buildKeepOnUntilOptions } from '../utils/keepOnUntil.util'
import type { InfraService } from '../types/infra.types'
import { fillTemplate } from '../utils/zonedTime.util'

type PowerConfirmDialogProps = {
  readonly environmentName: string
  readonly kind: InfraOperationKind
  readonly services: readonly InfraService[]
  readonly requiresKeepOnUntil: boolean
  readonly isPending: boolean
  readonly errorMessage: string | undefined
  readonly onConfirm: (keepOnUntil: string | undefined) => void
  readonly onClose: () => void
}

/** Montado so enquanto aberto: fechar descarta o que foi digitado e escolhido. */
export function PowerConfirmDialog({
  environmentName,
  kind,
  services,
  requiresKeepOnUntil,
  isPending,
  errorMessage,
  onConfirm,
  onClose,
}: PowerConfirmDialogProps) {
  const infraLocale = useInfraMessages()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const nameFieldId = useId()
  const [typedName, setTypedName] = useState('')
  const [selectedKeepOnId, setSelectedKeepOnId] = useState<KeepOnOptionId>(DEFAULT_KEEP_ON_OPTION_ID)
  const [openedAt] = useState(() => new Date())

  const isPowerOff = kind === INFRA_OPERATION_KIND.POWER_OFF
  const keepOnOptions = buildKeepOnUntilOptions({ now: openedAt })
  const servicesToStop = listServicesToStop(services)
  const isConfirmEnabled =
    !isPending && (!isPowerOff || matchesEnvironmentName({ typed: typedName, expected: environmentName }))
  const titleTemplate = isPowerOff ? infraLocale.power.confirmTitleOff : infraLocale.power.confirmTitleOn

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isConfirmEnabled) return

    const keepOnUntil = requiresKeepOnUntil
      ? keepOnOptions.find((option) => option.id === selectedKeepOnId)?.until
      : undefined
    onConfirm(keepOnUntil)
  }

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-0 text-gray-900 backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      onClose={onClose}
      ref={dialogRef}
    >
      <form className="space-y-4 p-5" onSubmit={handleSubmit}>
        <header className="space-y-1">
          <h2 className="text-base font-semibold" id={titleId}>
            {fillTemplate({ template: titleTemplate, values: { environment: environmentName } })}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300" id={descriptionId}>
            {isPowerOff ? infraLocale.power.confirmDescriptionOff : infraLocale.power.confirmDescriptionOn}
          </p>
        </header>

        {isPowerOff ? <ServicesToStop servicesToStop={servicesToStop} /> : null}

        {isPowerOff ? (
          <div>
            <label className={INFRA_LABEL} htmlFor={nameFieldId}>
              {fillTemplate({ template: infraLocale.power.typeToConfirm, values: { environment: environmentName } })}
            </label>
            <input
              autoComplete="off"
              className={INFRA_FIELD}
              id={nameFieldId}
              onChange={(event) => setTypedName(event.target.value)}
              placeholder={infraLocale.power.confirmPlaceholder}
              spellCheck={false}
              value={typedName}
            />
          </div>
        ) : null}

        {!isPowerOff && requiresKeepOnUntil ? (
          <KeepOnUntilPicker
            now={openedAt}
            onSelect={setSelectedKeepOnId}
            options={keepOnOptions}
            selectedId={selectedKeepOnId}
          />
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
            disabled={!isConfirmEnabled}
            type="submit"
          >
            {isPending
              ? infraLocale.power.pending
              : isPowerOff
                ? infraLocale.power.confirmOff
                : infraLocale.power.confirmOn}
          </button>
        </footer>
      </form>
    </dialog>
  )
}

type ServicesToStopProps = { readonly servicesToStop: readonly InfraService[] }

function ServicesToStop({ servicesToStop }: ServicesToStopProps) {
  const infraLocale = useInfraMessages()
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-medium">{infraLocale.power.willStop}</h3>
      <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md bg-gray-50 p-2 text-sm dark:bg-gray-800">
        {servicesToStop.map((service) => (
          <li className="flex items-center gap-1.5" key={service.serviceName}>
            {service.isDatabase ? (
              <Database aria-label={infraLocale.services.database} className="size-4 shrink-0" role="img" />
            ) : null}
            <span className="truncate">{service.serviceName}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-600 dark:text-gray-300">{infraLocale.power.databasesLast}</p>
    </section>
  )
}
