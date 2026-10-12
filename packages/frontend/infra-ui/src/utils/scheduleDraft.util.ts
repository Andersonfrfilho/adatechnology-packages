/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  BUSINESS_HOURS_POWER_OFF_TIME,
  BUSINESS_HOURS_POWER_ON_TIME,
  BUSINESS_HOURS_WEEKDAYS,
  SCHEDULE_VALIDATION_ERROR,
  type ScheduleValidationError,
} from '../constants/infraUi.constant'
import type { InfraSchedule } from '../types/infra.types'

export type ScheduleDraft = {
  readonly activeWeekdays: readonly number[]
  readonly powerOnTime: string
  readonly powerOffTime: string
  readonly isEnabled: boolean
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function createScheduleDraft(schedule: InfraSchedule | undefined): ScheduleDraft {
  if (schedule) {
    return {
      activeWeekdays: schedule.activeWeekdays,
      powerOnTime: schedule.powerOnTime,
      powerOffTime: schedule.powerOffTime,
      isEnabled: schedule.isEnabled,
    }
  }

  return {
    activeWeekdays: [],
    powerOnTime: BUSINESS_HOURS_POWER_ON_TIME,
    powerOffTime: BUSINESS_HOURS_POWER_OFF_TIME,
    isEnabled: true,
  }
}

export function applyBusinessHours(draft: ScheduleDraft): ScheduleDraft {
  return {
    ...draft,
    activeWeekdays: BUSINESS_HOURS_WEEKDAYS,
    powerOnTime: BUSINESS_HOURS_POWER_ON_TIME,
    powerOffTime: BUSINESS_HOURS_POWER_OFF_TIME,
  }
}

export function toggleWeekday({
  draft,
  weekday,
}: {
  readonly draft: ScheduleDraft
  readonly weekday: number
}): ScheduleDraft {
  const isSelected = draft.activeWeekdays.includes(weekday)
  const next = isSelected ? draft.activeWeekdays.filter((day) => day !== weekday) : [...draft.activeWeekdays, weekday]

  return { ...draft, activeWeekdays: [...next].sort((first, second) => first - second) }
}

/** Os mesmos limites que a API aplica (RF8): a tela barra antes, mas a API continua sendo a palavra final. */
export function validateScheduleDraft(draft: ScheduleDraft): readonly ScheduleValidationError[] {
  const errors: ScheduleValidationError[] = []

  if (draft.activeWeekdays.length === 0) errors.push(SCHEDULE_VALIDATION_ERROR.NO_WEEKDAYS)

  if (!TIME_PATTERN.test(draft.powerOnTime) || !TIME_PATTERN.test(draft.powerOffTime)) {
    errors.push(SCHEDULE_VALIDATION_ERROR.INVALID_TIME)
    return errors
  }

  if (draft.powerOnTime > draft.powerOffTime) errors.push(SCHEDULE_VALIDATION_ERROR.CROSSES_MIDNIGHT)
  if (draft.powerOnTime === draft.powerOffTime) errors.push(SCHEDULE_VALIDATION_ERROR.EMPTY_WINDOW)

  return errors
}
