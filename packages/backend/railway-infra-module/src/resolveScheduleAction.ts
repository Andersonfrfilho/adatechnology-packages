/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_SCHEDULE_ACTION } from '@adatechnology/railway-infra-contracts'
import { getZonedParts, isInsideWindow, parseWindow, zonedTimeToInstant, type MinuteWindow } from './scheduleTime'
import type {
  InfraScheduleAction,
  InfraScheduleWindowInput,
  InfraScheduledTransition,
  IsInsideScheduleWindowParams,
  ResolveScheduleActionParams,
  ResolveScheduleActionResult,
} from '@adatechnology/railway-infra-contracts'

const NEXT_ACTION_SCAN_DAYS = 8

function findNextBoundary(params: {
  readonly schedule: InfraScheduleWindowInput
  readonly window: MinuteWindow
  readonly now: Date
  readonly kind: typeof INFRA_SCHEDULE_ACTION.POWER_ON | typeof INFRA_SCHEDULE_ACTION.POWER_OFF
}): InfraScheduledTransition | undefined {
  const { schedule, window, now, kind } = params
  const today = getZonedParts({ date: now, timezone: schedule.timezone })
  for (let offset = 0; offset < NEXT_ACTION_SCAN_DAYS; offset += 1) {
    if (!schedule.activeWeekdays.includes((today.weekday + offset) % 7)) continue
    const calendarDay = new Date(Date.UTC(today.year, today.month - 1, today.day + offset))
    const at = zonedTimeToInstant({
      year: calendarDay.getUTCFullYear(),
      month: calendarDay.getUTCMonth() + 1,
      day: calendarDay.getUTCDate(),
      minuteOfDay: kind === INFRA_SCHEDULE_ACTION.POWER_OFF ? window.off : window.on,
      timezone: schedule.timezone,
    })
    if (at > now) return { kind, at }
  }
  return undefined
}

// Um keepOnUntil que passa do fim da janela adia o desligamento real: a agenda só desliga fora da janela e depois do vencimento.
function applyKeepOnExtension(params: {
  readonly schedule: InfraScheduleWindowInput
  readonly window: MinuteWindow
  readonly windowEnd: InfraScheduledTransition | undefined
}): InfraScheduledTransition | undefined {
  const { schedule, window, windowEnd } = params
  const { keepOnUntil, activeWeekdays, timezone } = schedule
  if (keepOnUntil === null || !windowEnd || keepOnUntil <= windowEnd.at) return windowEnd

  const isExpiryInsideWindow = isInsideWindow({
    parts: getZonedParts({ date: keepOnUntil, timezone }),
    activeWeekdays,
    window,
  })
  if (!isExpiryInsideWindow) return { kind: INFRA_SCHEDULE_ACTION.POWER_OFF, at: keepOnUntil }
  return findNextBoundary({ schedule, window, now: keepOnUntil, kind: INFRA_SCHEDULE_ACTION.POWER_OFF })
}

function findNextTransition(params: {
  readonly schedule: InfraScheduleWindowInput
  readonly window: MinuteWindow
  readonly now: Date
  readonly isInside: boolean
}): InfraScheduledTransition | undefined {
  const { schedule, window, now, isInside } = params
  const { keepOnUntil } = schedule
  const isKeepOnActive = keepOnUntil !== null && keepOnUntil > now
  const powerOff = INFRA_SCHEDULE_ACTION.POWER_OFF

  if (isInside) {
    const windowEnd = findNextBoundary({ schedule, window, now, kind: powerOff })
    return isKeepOnActive ? applyKeepOnExtension({ schedule, window, windowEnd }) : windowEnd
  }

  const nextEntry = findNextBoundary({ schedule, window, now, kind: INFRA_SCHEDULE_ACTION.POWER_ON })
  if (!isKeepOnActive) return nextEntry
  // Janela que abre até o vencimento assume o controle: o desligamento real é o fim dela, ou o vencimento se passar dele.
  if (nextEntry && nextEntry.at <= keepOnUntil) {
    const windowEnd = findNextBoundary({ schedule, window, now: nextEntry.at, kind: powerOff })
    return applyKeepOnExtension({ schedule, window, windowEnd })
  }
  return { kind: powerOff, at: keepOnUntil }
}

function decideAction(params: {
  readonly wasInside: boolean | undefined
  readonly isInside: boolean
  readonly isKeepOnActive: boolean
  readonly isKeepOnExpired: boolean
}): InfraScheduleAction {
  const { wasInside, isInside, isKeepOnActive, isKeepOnExpired } = params
  if (wasInside === false && isInside) return INFRA_SCHEDULE_ACTION.POWER_ON
  if (wasInside === true && !isInside) {
    return isKeepOnActive ? INFRA_SCHEDULE_ACTION.NONE : INFRA_SCHEDULE_ACTION.POWER_OFF
  }
  if (!isInside && isKeepOnExpired) return INFRA_SCHEDULE_ACTION.POWER_OFF
  return INFRA_SCHEDULE_ACTION.NONE
}

export function resolveScheduleAction(params: ResolveScheduleActionParams): ResolveScheduleActionResult {
  const { schedule, now } = params
  if (!schedule.isEnabled) {
    return { action: INFRA_SCHEDULE_ACTION.NONE, shouldClearKeepOn: false, nextScheduledAction: undefined }
  }
  const { activeWeekdays, timezone, keepOnUntil, lastEvaluatedAt } = schedule
  const window = parseWindow(schedule)
  const isInsideAt = (date: Date): boolean =>
    isInsideWindow({ parts: getZonedParts({ date, timezone }), activeWeekdays, window })
  const isInside = isInsideAt(now)
  const isKeepOnExpired = keepOnUntil !== null && keepOnUntil <= now
  // Só os lados de lastEvaluatedAt e now contam: uma lacuna longa age no máximo uma vez, mesmo cruzando vários limites.
  const action = decideAction({
    wasInside: lastEvaluatedAt === null ? undefined : isInsideAt(lastEvaluatedAt),
    isInside,
    isKeepOnActive: keepOnUntil !== null && keepOnUntil > now,
    isKeepOnExpired,
  })
  const nextScheduledAction = window === undefined ? undefined : findNextTransition({ schedule, window, now, isInside })
  return { action, shouldClearKeepOn: isKeepOnExpired, nextScheduledAction }
}

export function isInsideScheduleWindow(params: IsInsideScheduleWindowParams): boolean {
  const { schedule, at } = params
  return isInsideWindow({
    parts: getZonedParts({ date: at, timezone: schedule.timezone }),
    activeWeekdays: schedule.activeWeekdays,
    window: parseWindow(schedule),
  })
}
