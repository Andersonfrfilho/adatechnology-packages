/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_SCHEDULED_ACTION_KIND } from '../constants/infra.constant'
import { DEFAULT_INFRA_MESSAGES, type InfraMessages } from '../locales'
import type { InfraNextScheduledAction } from '../types/infra.types'
import { calendarDaysBetween, fillTemplate, formatZonedTime, getZonedParts } from './zonedTime.util'

const DAYS_TODAY = 0
const DAYS_TOMORROW = 1

/** "hoje às 20:00", "amanhã às 08:00" ou "seg 08:00", sempre no fuso America/Sao_Paulo. */
export function formatMoment({
  at,
  now,
  messages = DEFAULT_INFRA_MESSAGES,
}: {
  readonly at: Date
  readonly now: Date
  readonly messages?: InfraMessages
}): string {
  const infraLocale = messages
  const time = formatZonedTime(at)
  const daysAhead = calendarDaysBetween({ from: now, to: at })

  if (daysAhead === DAYS_TODAY) return fillTemplate({ template: infraLocale.moment.today, values: { time } })
  if (daysAhead === DAYS_TOMORROW) return fillTemplate({ template: infraLocale.moment.tomorrow, values: { time } })

  const weekday = infraLocale.schedule.weekdayNames[getZonedParts(at).weekday] ?? ''

  return fillTemplate({ template: infraLocale.moment.weekday, values: { weekday, time } })
}

/** "Desliga hoje às 20:00", "Liga seg 08:00". */
export function formatNextScheduledAction({
  nextScheduledAction,
  now,
  messages = DEFAULT_INFRA_MESSAGES,
}: {
  readonly nextScheduledAction: InfraNextScheduledAction
  readonly now: Date
  readonly messages?: InfraMessages
}): string {
  const infraLocale = messages
  const verb =
    nextScheduledAction.kind === INFRA_SCHEDULED_ACTION_KIND.POWER_ON
      ? infraLocale.schedule.nextPowerOn
      : infraLocale.schedule.nextPowerOff

  return `${verb} ${formatMoment({ at: new Date(nextScheduledAction.at), now, messages })}`
}
