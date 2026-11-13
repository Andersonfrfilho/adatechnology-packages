/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'

import type { NotificationDatabase } from '../database.types'
import { devices, type DeviceRow, type NewDeviceRow } from '../schema/schema'

// Exportada para o teste de isolamento (T3.5) — mesmo raciocínio de `NotificationRepository`.
export function deviceActiveByUserCondition(params: { companyId: string; userId: string }): SQL {
  return and(eq(devices.companyId, params.companyId), eq(devices.userId, params.userId), isNull(devices.disabledAt))!
}

export function deviceOwnedByCondition(params: { companyId: string; userId: string; id: string }): SQL {
  return and(eq(devices.companyId, params.companyId), eq(devices.userId, params.userId), eq(devices.id, params.id))!
}

export class DeviceRepository {
  constructor(private readonly db: NotificationDatabase) {}

  /**
   * Idempotente por `(driver, token)` — reinstalar o app com o mesmo token reativa o device
   * existente (zera `disabledAt`) em vez de duplicar linha. É o token que identifica o aparelho,
   * não o par `(companyId, userId)`: o mesmo token nunca aponta para duas empresas ao mesmo
   * tempo, então o conflito é global por design.
   */
  async upsertByDriverAndToken(values: NewDeviceRow): Promise<DeviceRow> {
    const [row] = await this.db
      .insert(devices)
      .values(values)
      .onConflictDoUpdate({
        target: [devices.driver, devices.token],
        set: {
          companyId: values.companyId,
          userId: values.userId,
          platform: values.platform,
          appVersion: values.appVersion,
          locale: values.locale,
          timezone: values.timezone,
          lastSeenAt: new Date(),
          disabledAt: null,
          disabledReason: null,
          updatedAt: new Date(),
        },
      })
      .returning()
    if (!row) throw new Error('notification-module: upsert em devices não retornou linha')
    return row
  }

  async listActiveByUser(params: { companyId: string; userId: string }): Promise<DeviceRow[]> {
    return this.db.select().from(devices).where(deviceActiveByUserCondition(params))
  }

  async findById(params: { id: string }): Promise<DeviceRow | undefined> {
    const [row] = await this.db.select().from(devices).where(eq(devices.id, params.id)).limit(1)
    return row
  }

  /** Chamado a partir de `outcome: 'invalid_target'` — nunca por uma rota exposta ao cliente. */
  async disable(params: { id: string; reason: string }): Promise<void> {
    await this.db
      .update(devices)
      .set({ disabledAt: new Date(), disabledReason: params.reason, updatedAt: new Date() })
      .where(eq(devices.id, params.id))
  }

  async unregister(params: { companyId: string; userId: string; id: string }): Promise<boolean> {
    const [row] = await this.db.delete(devices).where(deviceOwnedByCondition(params)).returning({ id: devices.id })
    return row !== undefined
  }

  // Usado só por teste de isolamento (T3.5) para confirmar que a contagem de dispositivos
  // ativos nunca vaza entre empresas — não é operação exposta ao host.
  async countByCompany(params: { companyId: string }): Promise<number> {
    const [result] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(devices)
      .where(eq(devices.companyId, params.companyId))
    return result?.value ?? 0
  }
}
