/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { buildKeepOnUntilOptions, isKeepOnUntilRequired } from './keepOnUntil.util'
import { formatNextScheduledAction } from './scheduledAction.util'
import {
  applyBusinessHours,
  createScheduleDraft,
  toggleWeekday,
  validateScheduleDraft,
  type ScheduleDraft,
} from './scheduleDraft.util'
import type { InfraEnvironment, InfraSchedule } from '../types/infra.types'
import { getEndOfZonedDay } from './zonedTime.util'

// 2026-10-09 e sexta-feira; Brasilia fica em UTC-3.
const FRIDAY_NOON = new Date('2026-10-09T15:00:00Z')

const SCHEDULE: InfraSchedule = {
  id: 's',
  activeWeekdays: [1, 2, 3, 4, 5],
  powerOnTime: '08:00',
  powerOffTime: '20:00',
  timezone: 'America/Sao_Paulo',
  isEnabled: true,
  keepOnUntil: null,
  lastEvaluatedAt: null,
  lastPowerOffAt: null,
  lastPowerOnAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}

const VALID_DRAFT: ScheduleDraft = {
  activeWeekdays: [1, 2, 3],
  powerOnTime: '08:00',
  powerOffTime: '20:00',
  isEnabled: true,
}

describe('getEndOfZonedDay', () => {
  it('returns the next midnight in Sao Paulo', () => {
    expect(getEndOfZonedDay(FRIDAY_NOON).toISOString()).toBe('2026-10-10T03:00:00.000Z')
  })

  it('uses the local day, not the UTC day, late at night', () => {
    expect(getEndOfZonedDay(new Date('2026-10-10T02:30:00Z')).toISOString()).toBe('2026-10-10T03:00:00.000Z')
  })
})

describe('buildKeepOnUntilOptions', () => {
  it('offers +1 h, +2 h, +4 h and end of day', () => {
    const options = buildKeepOnUntilOptions({ now: FRIDAY_NOON })

    expect(options.map((option) => option.id)).toEqual(['plusOneHour', 'plusTwoHours', 'plusFourHours', 'endOfDay'])
    expect(options[0]?.until).toBe('2026-10-09T16:00:00.000Z')
    expect(options[1]?.until).toBe('2026-10-09T17:00:00.000Z')
    expect(options[2]?.until).toBe('2026-10-09T19:00:00.000Z')
    expect(options[3]?.until).toBe('2026-10-10T03:00:00.000Z')
  })

  it('never goes beyond 24 h', () => {
    const limit = FRIDAY_NOON.getTime() + 24 * 60 * 60 * 1000
    const options = buildKeepOnUntilOptions({ now: FRIDAY_NOON })

    for (const option of options) expect(new Date(option.until).getTime()).toBeLessThanOrEqual(limit)
  })

  it('makes end of day shorter than +1 h when it is almost midnight', () => {
    const options = buildKeepOnUntilOptions({ now: new Date('2026-10-10T02:30:00Z') })
    const endOfDay = options.find((option) => option.id === 'endOfDay')

    expect(endOfDay?.until).toBe('2026-10-10T03:00:00.000Z')
  })
})

describe('isKeepOnUntilRequired', () => {
  const environment: InfraEnvironment = {
    environmentId: 'e',
    environmentName: 'staging',
    classification: 'managed',
    state: 'stopped',
    services: [],
    requiresKeepOnUntil: false,
  }

  it('follows the server flag when it is true, even with keepOnUntil making the next action power off', () => {
    const withKeepOn = {
      ...environment,
      requiresKeepOnUntil: true,
      schedule: { ...SCHEDULE, keepOnUntil: '2026-10-09T23:00:00Z' },
      nextScheduledAction: { kind: 'power_off', at: '2026-10-09T23:00:00Z' },
    } as const

    expect(isKeepOnUntilRequired({ environment: withKeepOn })).toBe(true)
  })

  it('follows the server flag when it is false, even if the next action is power on', () => {
    const paused = {
      ...environment,
      schedule: { ...SCHEDULE, isEnabled: false },
      nextScheduledAction: { kind: 'power_on', at: '2026-10-12T11:00:00Z' },
    } as const

    expect(isKeepOnUntilRequired({ environment: paused })).toBe(false)
  })
})

describe('formatNextScheduledAction', () => {
  it('formats a same-day action', () => {
    const text = formatNextScheduledAction({
      nextScheduledAction: { kind: 'power_off', at: '2026-10-09T23:00:00Z' },
      now: FRIDAY_NOON,
    })

    expect(text).toBe('Desliga hoje às 20:00')
  })

  it('formats an action on the next day', () => {
    const text = formatNextScheduledAction({
      nextScheduledAction: { kind: 'power_on', at: '2026-10-10T11:00:00Z' },
      now: FRIDAY_NOON,
    })

    expect(text).toBe('Liga amanhã às 08:00')
  })

  it('formats a later action with the weekday', () => {
    const text = formatNextScheduledAction({
      nextScheduledAction: { kind: 'power_on', at: '2026-10-12T11:00:00Z' },
      now: FRIDAY_NOON,
    })

    expect(text).toBe('Liga seg 08:00')
  })

  it('decides the day by the Sao Paulo calendar, not by UTC', () => {
    const text = formatNextScheduledAction({
      nextScheduledAction: { kind: 'power_on', at: '2026-10-10T11:00:00Z' },
      now: new Date('2026-10-10T02:00:00Z'),
    })

    expect(text).toBe('Liga amanhã às 08:00')
  })
})

describe('validateScheduleDraft', () => {
  it('accepts a valid draft', () => {
    expect(validateScheduleDraft(VALID_DRAFT)).toEqual([])
  })

  it('requires at least one weekday', () => {
    expect(validateScheduleDraft({ ...VALID_DRAFT, activeWeekdays: [] })).toEqual(['no_weekdays'])
  })

  it('rejects empty times', () => {
    expect(validateScheduleDraft({ ...VALID_DRAFT, powerOnTime: '' })).toEqual(['invalid_time'])
  })

  it('rejects a window that crosses midnight', () => {
    expect(validateScheduleDraft({ ...VALID_DRAFT, powerOnTime: '22:00', powerOffTime: '02:00' })).toEqual([
      'crosses_midnight',
    ])
  })

  it('rejects equal times', () => {
    expect(validateScheduleDraft({ ...VALID_DRAFT, powerOnTime: '08:00', powerOffTime: '08:00' })).toEqual([
      'empty_window',
    ])
  })
})

describe('schedule draft helpers', () => {
  it('starts a new draft without weekdays so nothing is scheduled by accident', () => {
    expect(createScheduleDraft(undefined).activeWeekdays).toEqual([])
  })

  it('copies an existing schedule', () => {
    expect(createScheduleDraft(SCHEDULE)).toEqual({
      activeWeekdays: [1, 2, 3, 4, 5],
      powerOnTime: '08:00',
      powerOffTime: '20:00',
      isEnabled: true,
    })
  })

  it('applies business hours without touching isEnabled', () => {
    const draft = applyBusinessHours({ ...VALID_DRAFT, activeWeekdays: [0], powerOnTime: '10:00', isEnabled: false })

    expect(draft).toEqual({
      activeWeekdays: [1, 2, 3, 4, 5],
      powerOnTime: '08:00',
      powerOffTime: '20:00',
      isEnabled: false,
    })
  })

  it('toggles weekdays keeping them sorted', () => {
    const added = toggleWeekday({ draft: VALID_DRAFT, weekday: 0 })
    const removed = toggleWeekday({ draft: added, weekday: 2 })

    expect(added.activeWeekdays).toEqual([0, 1, 2, 3])
    expect(removed.activeWeekdays).toEqual([0, 1, 3])
  })
})
