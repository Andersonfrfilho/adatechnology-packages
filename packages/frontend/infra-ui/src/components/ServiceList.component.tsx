/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Database } from 'lucide-react'

import { INFRA_SERVICE_POWER_STATE } from '../constants/infra.constant'
import { useInfraMessages } from '../providers'
import { INFRA_DISCLOSURE_SUMMARY, INFRA_FOCUS_RING } from '../constants/infraStyle.constant'
import { ServicePowerButton } from './ServicePowerButton.component'
import type { InfraEnvironment, InfraService } from '../types/infra.types'
import { useInfraCapabilities } from '../providers'
import { fillTemplate } from '../utils/zonedTime.util'

type ServiceListProps = {
  readonly services: readonly InfraService[]
  /** Com o ambiente, cada serviço ganha o botão de ligar ou desligar só ele. */
  readonly environment?: InfraEnvironment
}

export function ServiceList({ services, environment }: ServiceListProps) {
  const infraLocale = useInfraMessages()
  const { canPower } = useInfraCapabilities()
  const runningCount = services.filter((service) => service.powerState === INFRA_SERVICE_POWER_STATE.RUNNING).length
  const summary = fillTemplate({
    template: infraLocale.services.summary,
    values: { running: String(runningCount), total: String(services.length) },
  })

  return (
    <details>
      <summary className={`${INFRA_DISCLOSURE_SUMMARY} ${INFRA_FOCUS_RING}`}>
        {infraLocale.services.title}
        <span className="ml-2 font-normal text-gray-600 tabular-nums dark:text-gray-300">{summary}</span>
      </summary>
      <ul className="mt-2 grid gap-1 tablet:grid-cols-2">
        {services.map((service) => (
          <li
            className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-sm dark:bg-gray-800"
            key={service.serviceName}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-gray-900 dark:text-gray-100">
              {service.isDatabase ? (
                <Database
                  aria-label={infraLocale.services.database}
                  className="size-4 shrink-0 text-gray-600 dark:text-gray-300"
                  role="img"
                />
              ) : null}
              <span className="truncate">{service.serviceName}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              {infraLocale.services[service.powerState]}
              {environment && canPower ? <ServicePowerButton environment={environment} service={service} /> : null}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
