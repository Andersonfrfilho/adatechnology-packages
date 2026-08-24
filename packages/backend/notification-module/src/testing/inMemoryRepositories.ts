/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublês em memória que satisfazem as portas estreitas dos use-cases — a suíte de comportamento
 * roda sem Postgres. O isolamento multiempresa real (cláusula SQL) é coberto por
 * `repositories/isolation.test.ts`, que renderiza o SQL de verdade; aqui o foco é a lógica de
 * fan-out, retry e idempotência.
 */

import { randomUUID } from 'node:crypto'

import type {
  DeliveryRow,
  DeviceRow,
  NewDeliveryRow,
  NewNotificationRow,
  NotificationRow,
  PreferenceRow,
  TemplateRow,
} from '../schema/schema'

const EPOCH = new Date('2026-08-02T12:00:00.000Z')

export function createInMemoryNotifications() {
  const rows: NotificationRow[] = []

  return {
    rows,
    async create(values: NewNotificationRow): Promise<NotificationRow> {
      const row = {
        id: randomUUID(),
        payload: {},
        status: 'pending',
        dedupeKey: null,
        scheduledFor: null,
        readAt: null,
        deletedAt: null,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        ...values,
      } as NotificationRow
      rows.push(row)
      return row
    },
    async findByDedupeKey(params: { companyId: string; dedupeKey: string }): Promise<NotificationRow | undefined> {
      return rows.find((row) => row.companyId === params.companyId && row.dedupeKey === params.dedupeKey)
    },
    async findByIdForCompany(params: { companyId: string; id: string }): Promise<NotificationRow | undefined> {
      return rows.find((row) => row.companyId === params.companyId && row.id === params.id)
    },
    async updateStatus(params: { companyId: string; id: string; status: string }): Promise<void> {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (row) row.status = params.status
    },
    async purgeExpired(params: { olderThan: Date }): Promise<number> {
      const before = rows.length
      const kept = rows.filter((row) => row.createdAt >= params.olderThan)
      rows.length = 0
      rows.push(...kept)
      return before - rows.length
    },
  }
}

export function createInMemoryDeliveries() {
  const rows: DeliveryRow[] = []

  return {
    rows,
    async create(values: NewDeliveryRow): Promise<DeliveryRow> {
      const row = {
        id: randomUUID(),
        driver: null,
        deviceId: null,
        targetMasked: null,
        status: 'queued',
        attempt: 0,
        providerMessageId: null,
        errorCode: null,
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        ...values,
      } as DeliveryRow
      rows.push(row)
      return row
    },
    async findById(params: { companyId: string; id: string }): Promise<DeliveryRow | undefined> {
      return rows.find((row) => row.companyId === params.companyId && row.id === params.id)
    },
    async listByNotification(params: { companyId: string; notificationId: string }): Promise<DeliveryRow[]> {
      return rows.filter((row) => row.companyId === params.companyId && row.notificationId === params.notificationId)
    },
    async findByProviderMessage(params: {
      channel: string
      providerMessageId: string
    }): Promise<DeliveryRow | undefined> {
      return rows.find((row) => row.channel === params.channel && row.providerMessageId === params.providerMessageId)
    },
    async updateAttempt(params: {
      companyId: string
      id: string
      status: string
      attempt?: number
      providerMessageId?: string
      errorCode?: string
      sentAt?: Date
      deliveredAt?: Date
      failedAt?: Date
    }): Promise<DeliveryRow | undefined> {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return undefined
      row.status = params.status
      if (params.attempt !== undefined) row.attempt = params.attempt
      if (params.providerMessageId !== undefined) row.providerMessageId = params.providerMessageId
      if (params.errorCode !== undefined) row.errorCode = params.errorCode
      if (params.sentAt !== undefined) row.sentAt = params.sentAt
      if (params.deliveredAt !== undefined) row.deliveredAt = params.deliveredAt
      if (params.failedAt !== undefined) row.failedAt = params.failedAt
      return row
    },
  }
}

export function createInMemoryDevices(seed: DeviceRow[] = []) {
  const rows: DeviceRow[] = [...seed]

  return {
    rows,
    async listActiveByUser(params: { companyId: string; userId: string }): Promise<DeviceRow[]> {
      return rows.filter((row) => row.companyId === params.companyId && row.userId === params.userId && !row.disabledAt)
    },
    async findById(params: { id: string }): Promise<DeviceRow | undefined> {
      return rows.find((row) => row.id === params.id)
    },
    async disable(params: { id: string; reason: string }): Promise<void> {
      const row = rows.find((candidate) => candidate.id === params.id)
      if (row) {
        row.disabledAt = EPOCH
        row.disabledReason = params.reason
      }
    },
  }
}

export function createInMemoryPreferences(seed: PreferenceRow[] = []) {
  return {
    rows: seed,
    async listByUser(params: { companyId: string; userId: string }): Promise<PreferenceRow[]> {
      return seed.filter((row) => row.companyId === params.companyId && row.userId === params.userId)
    },
  }
}

export function createInMemoryTemplates(seed: TemplateRow[] = []) {
  return {
    rows: seed,
    async findById(params: { companyId: string; id: string }): Promise<TemplateRow | undefined> {
      return seed.find((row) => row.companyId === params.companyId && row.id === params.id)
    },
    async deactivateIdentity(params: {
      companyId: string
      key: string
      channel: string
      locale: string
    }): Promise<number> {
      let affected = 0
      for (const [index, row] of seed.entries()) {
        if (
          row.companyId !== params.companyId ||
          row.key !== params.key ||
          row.channel !== params.channel ||
          row.locale !== params.locale ||
          !row.active
        ) {
          continue
        }
        seed[index] = { ...row, active: false }
        affected += 1
      }
      return affected
    },
    async listByCompany(params: { companyId: string }): Promise<TemplateRow[]> {
      return seed.filter((row) => row.companyId === params.companyId)
    },
    async upsert(params: { companyId: string; key: string; channel: string; locale: string }): Promise<TemplateRow> {
      const previous = seed.filter(
        (row) =>
          row.companyId === params.companyId &&
          row.key === params.key &&
          row.channel === params.channel &&
          row.locale === params.locale,
      )
      const row = buildTemplateRow({
        ...(params as never),
        version: Math.max(0, ...previous.map((each) => each.version)) + 1,
      })
      seed.push(row)
      return row
    },
    async findActive(params: {
      companyId: string
      key: string
      channel: string
      locale: string
    }): Promise<TemplateRow | undefined> {
      return seed.find(
        (row) =>
          row.companyId === params.companyId &&
          row.key === params.key &&
          row.channel === params.channel &&
          row.locale === params.locale &&
          row.active,
      )
    },
  }
}

export function createInMemorySuppressions(seed: { companyId: string; channel: string; targetHash: string }[] = []) {
  const rows = [...seed]

  return {
    rows,
    async isSuppressed(params: { companyId: string; channel: string; targetHash: string }): Promise<boolean> {
      return rows.some(
        (row) =>
          row.companyId === params.companyId && row.channel === params.channel && row.targetHash === params.targetHash,
      )
    },
    async create(params: { companyId: string; channel: string; targetHash: string; reason: string }): Promise<unknown> {
      rows.push(params)
      return params
    },
  }
}

export function createRecordingQueue() {
  const enqueued: {
    job: { notificationId: string; deliveryId: string; channel: string; attempt: number }
    delaySeconds?: number
  }[] = []

  return {
    enqueued,
    async enqueue(params: { job: never; delaySeconds?: number }): Promise<void> {
      enqueued.push(params as never)
    },
    async consume(): Promise<void> {},
    async close(): Promise<void> {},
  }
}

export function buildTemplateRow(
  overrides: Partial<TemplateRow> & Pick<TemplateRow, 'companyId' | 'key' | 'channel'>,
): TemplateRow {
  return {
    id: randomUUID(),
    locale: 'pt-BR',
    version: 1,
    subject: null,
    body: 'Olá {{name}}',
    whatsappTemplateName: null,
    active: true,
    createdAt: EPOCH,
    updatedAt: EPOCH,
    ...overrides,
  } as TemplateRow
}

export function buildDeviceRow(overrides: Partial<DeviceRow> & Pick<DeviceRow, 'companyId' | 'userId'>): DeviceRow {
  return {
    id: randomUUID(),
    platform: 'android',
    driver: 'fcm',
    token: `token-${randomUUID()}`,
    appVersion: null,
    locale: null,
    timezone: null,
    lastSeenAt: EPOCH,
    disabledAt: null,
    disabledReason: null,
    createdAt: EPOCH,
    updatedAt: EPOCH,
    ...overrides,
  } as DeviceRow
}

export function buildPreferenceRow(
  overrides: Partial<PreferenceRow> & Pick<PreferenceRow, 'companyId' | 'userId' | 'category' | 'channel'>,
): PreferenceRow {
  return {
    id: randomUUID(),
    enabled: true,
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: null,
    createdAt: EPOCH,
    updatedAt: EPOCH,
    ...overrides,
  } as PreferenceRow
}
