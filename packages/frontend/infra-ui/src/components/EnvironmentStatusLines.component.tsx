/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Clock, LoaderCircle, TimerReset } from 'lucide-react'

import { useInfraMessages } from '../providers'
import { formatMoment, formatNextScheduledAction } from '../utils/scheduledAction.util'
import type { InfraEnvironment } from '../types/infra.types'
import { fillTemplate } from '../utils/zonedTime.util'

type EnvironmentStatusLinesProps = {
  readonly environment: InfraEnvironment
}

const LINE = 'flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100'

export function EnvironmentStatusLines({ environment }: EnvironmentStatusLinesProps) {
  const infraLocale = useInfraMessages()
  const now = new Date()
  const { nextScheduledAction, schedule, runningOperationId } = environment
  const keepOnUntil = schedule?.keepOnUntil ? new Date(schedule.keepOnUntil) : undefined
  const isKeepOnActive = keepOnUntil !== undefined && keepOnUntil.getTime() > now.getTime()

  return (
    <div className="space-y-1.5">
      {runningOperationId !== undefined ? (
        <p className={`${LINE} font-medium`} role="status">
          <LoaderCircle aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
          {infraLocale.power.operationRunning}
        </p>
      ) : null}

      {nextScheduledAction ? (
        <p className={LINE}>
          <Clock aria-hidden="true" className="size-4 shrink-0 text-gray-600 dark:text-gray-300" />
          <span className="sr-only">{infraLocale.schedule.next}: </span>
          <span className="tabular-nums">
            {formatNextScheduledAction({ nextScheduledAction, now, messages: infraLocale })}
          </span>
        </p>
      ) : null}

      {isKeepOnActive ? (
        <p className={LINE}>
          <TimerReset aria-hidden="true" className="size-4 shrink-0 text-gray-600 dark:text-gray-300" />
          <span className="tabular-nums">
            {fillTemplate({
              template: infraLocale.keepOn.activeUntil,
              values: { moment: formatMoment({ at: keepOnUntil, now, messages: infraLocale }) },
            })}
          </span>
        </p>
      ) : null}
    </div>
  )
}
