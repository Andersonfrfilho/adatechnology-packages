/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ValidateScheduleWindowParams } from '@adatechnology/railway-infra-contracts'

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const MINUTES_PER_HOUR = 60
const FIRST_WEEKDAY = 0
const LAST_WEEKDAY = 6

function toMinuteOfDay(time: string): number | undefined {
  const match = TIME_PATTERN.exec(time)
  if (match === null) return undefined
  return Number(match[1]) * MINUTES_PER_HOUR + Number(match[2])
}

function validateWeekdays(activeWeekdays: readonly number[]): string[] {
  if (activeWeekdays.length === 0) return ['informe ao menos um dia da semana']
  const isEveryDayValid = activeWeekdays.every(
    (day) => Number.isInteger(day) && day >= FIRST_WEEKDAY && day <= LAST_WEEKDAY,
  )
  if (!isEveryDayValid) return ['os dias devem ser inteiros de 0 (domingo) a 6 (sabado)']
  if (new Set(activeWeekdays).size !== activeWeekdays.length) return ['os dias nao podem se repetir']
  return []
}

function validateTimes(params: Pick<ValidateScheduleWindowParams, 'powerOnTime' | 'powerOffTime'>): string[] {
  const on = toMinuteOfDay(params.powerOnTime)
  const off = toMinuteOfDay(params.powerOffTime)
  const issues: string[] = []
  if (on === undefined) issues.push('o horario de ligar deve estar no formato HH:mm (00:00 a 23:59)')
  if (off === undefined) issues.push('o horario de desligar deve estar no formato HH:mm (00:00 a 23:59)')
  if (on !== undefined && off !== undefined && on >= off) {
    issues.push('o horario de ligar deve ser anterior ao de desligar; janela que cruza a meia-noite nao e aceita')
  }
  return issues
}

/** Devolve todos os problemas de uma vez; lista vazia significa agenda valida. */
export function validateScheduleWindow(params: ValidateScheduleWindowParams): string[] {
  return [...validateWeekdays(params.activeWeekdays), ...validateTimes(params)]
}
