/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Descritor de cron para `SweepDueReminders`. O host registra `schedules` no agendador dele — o
 * módulo não escolhe biblioteca de cron nem abre timer próprio (mesmo molde de
 * `notification-module/src/worker.ts`, `createNotificationSchedules`).
 *
 * `tasks.md` (T6.3) descreve `createSchedulingWorker({ db, queue })` com `QueuePort` injetado. Essa
 * forma foi revista: não existe `QueuePort` nos providers de agendamento (`T1.3` só escopou
 * `VideoMeetingPort`, `CalendarSyncPort`, `ClockPort`, `LoggerPort`), e a spec §10 rejeita
 * explicitamente lembrete como job enfileirado — a varredura lê `reminderSentAt` fresco a cada
 * chamada, sem fila de saída nenhuma. `createSchedulingSchedules` recebe o módulo já composto
 * (que já carrega `db` via `createSchedulingModule`) e não precisa de fila: `SweepDueReminders`
 * só lê/grava no Postgres e emite o hook já existente (`onBookingReminderDue`). Documentado de
 * novo no README (T6.4).
 */

import type { SchedulingModule } from './SchedulingModule'

export type SchedulingSchedule = {
  readonly name: string
  readonly cronExpression: string
  run(): Promise<void>
}

export function createSchedulingSchedules(module: SchedulingModule): SchedulingSchedule[] {
  return [
    {
      name: 'scheduling:sweep-due-reminders',
      cronExpression: '* * * * *',
      async run(): Promise<void> {
        await module.useCases.sweepDueReminders.execute()
      },
    },
  ]
}
