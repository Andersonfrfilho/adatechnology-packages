/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Fan-out por preferência + quiet hours (spec §10, regras 1 e 4). Suppressão e throttle (regras
 * 5 e 8) são checados por `SendNotification.use-case` — dependem de I/O (repositório, cache) que
 * este arquivo, deliberadamente puro e síncrono, não faz.
 */

import { INTRUSIVE_CHANNELS, NOTIFICATION_CHANNEL } from '@adatechnology/notification-contracts'
import type { NotificationChannel } from '@adatechnology/notification-contracts'

import { currentHHmmInTimezone, isWithinQuietHours, nextAllowedInstant } from './quietHours'

export type ChannelPreference = {
  readonly category: string
  readonly channel: string
  readonly enabled: boolean
}

export type PlannedChannelAction = 'send' | 'skip' | 'reschedule'

export type PlannedChannel = {
  readonly channel: NotificationChannel
  readonly action: PlannedChannelAction
  readonly reason?: string
  readonly scheduledFor?: Date
}

export type QuietHoursWindow = { readonly start: string; readonly end: string; readonly timezone: string }

export type PlanDeliveriesParams = {
  readonly category: string
  /** Canais explícitos do chamador — presente, ignora preferência (o chamador decidiu por ela). */
  readonly explicitChannels?: readonly NotificationChannel[]
  readonly availableChannels: ReadonlySet<NotificationChannel>
  readonly preferences: readonly ChannelPreference[]
  /**
   * Uma janela por canal — o schema guarda `quietHoursStart`/`End` por linha de preferência
   * (`companyId, userId, category, channel`), não um horário único por usuário. Canal ausente do
   * mapa não tem janela configurada e nunca é reagendado.
   */
  readonly quietHoursByChannel?: ReadonlyMap<NotificationChannel, QuietHoursWindow>
  readonly now: Date
}

function isEnabledByPreference(params: {
  category: string
  channel: NotificationChannel
  preferences: readonly ChannelPreference[]
}): boolean {
  const row = params.preferences.find(
    (preference) => preference.category === params.category && preference.channel === params.channel,
  )
  // Sem linha, o canal é opt-out (habilitado por padrão) — o host não pode saber de antemão
  // toda categoria que um produto vai inventar, então a ausência de preferência não pode
  // significar "desligado": isso silenciaria toda notificação nova até o usuário abrir o
  // painel e ligar cada categoria manualmente.
  return row?.enabled ?? true
}

function resolveCandidateChannels(params: PlanDeliveriesParams): NotificationChannel[] {
  if (params.explicitChannels) return [...params.explicitChannels]
  return [...params.availableChannels].filter((channel) =>
    isEnabledByPreference({ category: params.category, channel, preferences: params.preferences }),
  )
}

export function planDeliveries(params: PlanDeliveriesParams): PlannedChannel[] {
  const candidates = resolveCandidateChannels(params)

  return candidates.map((channel): PlannedChannel => {
    if (!params.availableChannels.has(channel)) {
      return { channel, action: 'skip', reason: 'channel_not_configured' }
    }

    // Inbox nunca é suprimido por preferência nem por quiet hours — é o próprio histórico do
    // usuário, não uma interrupção externa (spec §10, regra 2).
    if (channel === NOTIFICATION_CHANNEL.INBOX) return { channel, action: 'send' }

    const window = params.quietHoursByChannel?.get(channel)
    if (window && INTRUSIVE_CHANNELS.includes(channel)) {
      const currentHHmm = currentHHmmInTimezone(window.timezone, params.now)
      const withinQuietHours = isWithinQuietHours({ currentHHmm, start: window.start, end: window.end })
      if (withinQuietHours) {
        const scheduledFor = nextAllowedInstant({ now: params.now, timezone: window.timezone, endHHmm: window.end })
        return { channel, action: 'reschedule', reason: 'quiet_hours', scheduledFor }
      }
    }

    return { channel, action: 'send' }
  })
}
