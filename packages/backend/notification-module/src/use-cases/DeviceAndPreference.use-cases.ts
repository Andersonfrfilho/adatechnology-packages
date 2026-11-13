/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Registro de dispositivo e preferências — mesmo padrão de agrupamento de
 * `Inbox.use-cases.ts`.
 */

import {
  DeviceNotFoundError,
  type DevicePlatform,
  type NotificationHooks,
  type PushDriver,
} from '@adatechnology/notification-contracts'
import type { DeviceRepository } from '../repositories/DeviceRepository'
import type { PreferenceRepository, PreferenceUpsertInput } from '../repositories/PreferenceRepository'
import type { DeviceRow, PreferenceRow } from '../schema/schema'

function toDeviceRegistration(row: DeviceRow) {
  return {
    id: row.id,
    platform: row.platform as DevicePlatform,
    driver: row.driver as PushDriver,
    appVersion: row.appVersion ?? undefined,
    locale: row.locale ?? undefined,
    timezone: row.timezone ?? undefined,
    lastSeenAt: row.lastSeenAt.toISOString(),
    disabledAt: row.disabledAt?.toISOString(),
    disabledReason: row.disabledReason ?? undefined,
  }
}

function toNotificationPreference(row: PreferenceRow) {
  return {
    category: row.category,
    channel: row.channel,
    enabled: row.enabled,
    quietHoursStart: row.quietHoursStart ?? undefined,
    quietHoursEnd: row.quietHoursEnd ?? undefined,
    timezone: row.timezone ?? undefined,
  }
}

export type RegisterDeviceParams = {
  companyId: string
  userId: string
  platform: DevicePlatform
  driver: PushDriver
  token: string
  appVersion?: string
  locale?: string
  timezone?: string
}

export class RegisterDeviceUseCase {
  constructor(
    private readonly devices: DeviceRepository,
    private readonly hooks?: NotificationHooks,
  ) {}

  async execute(params: RegisterDeviceParams): Promise<ReturnType<typeof toDeviceRegistration>> {
    const row = await this.devices.upsertByDriverAndToken(params)
    await this.hooks?.onDeviceRegistered?.({
      companyId: params.companyId,
      occurredAt: new Date(),
      deviceId: row.id,
      userId: params.userId,
      platform: params.platform,
      driver: params.driver,
    })
    return toDeviceRegistration(row)
  }
}

export class UnregisterDeviceUseCase {
  constructor(private readonly devices: DeviceRepository) {}

  async execute(params: { companyId: string; userId: string; id: string }): Promise<void> {
    const removed = await this.devices.unregister(params)
    if (!removed) throw new DeviceNotFoundError(params.id)
  }
}

export class GetPreferencesUseCase {
  constructor(private readonly preferences: PreferenceRepository) {}

  async execute(params: { companyId: string; userId: string }) {
    const rows = await this.preferences.listByUser(params)
    return rows.map(toNotificationPreference)
  }
}

export class UpdatePreferencesUseCase {
  constructor(
    private readonly preferences: PreferenceRepository,
    private readonly hooks?: NotificationHooks,
  ) {}

  async execute(params: { companyId: string; userId: string; preferences: readonly PreferenceUpsertInput[] }) {
    const rows = await this.preferences.upsertMany(params)
    await this.hooks?.onPreferencesUpdated?.({
      companyId: params.companyId,
      occurredAt: new Date(),
      userId: params.userId,
      categories: [...new Set(params.preferences.map((preference) => preference.category))],
    })
    return rows.map(toNotificationPreference)
  }
}
