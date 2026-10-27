/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { z } from 'zod'

import { DEVICE_PLATFORM, NOTIFICATION_CHANNEL, PUSH_DRIVER, SUPPRESSION_REASON } from './notification.types'

/**
 * Schemas de fronteira. Regra que atravessa todos eles: **`companyId` nunca vem do corpo da
 * requisição** — é derivado do contexto autenticado (`database.md`, "Consistência e
 * multiempresa"). Aceitá-lo aqui seria entregar o isolamento multiempresa ao cliente.
 */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_PER_PAGE = 100

const quietHoursShape = {
  quietHoursStart: z.string().regex(HHMM, 'Use HH:mm').optional(),
  quietHoursEnd: z.string().regex(HHMM, 'Use HH:mm').optional(),
  timezone: z.string().min(1).optional(),
}

export const sendNotificationSchema = z.object({
  recipientUserId: z.string().uuid(),
  category: z.string().min(1).max(64),
  templateKey: z.string().min(1).max(128),
  payload: z.record(z.unknown()).optional(),
  channels: z.array(z.nativeEnum(NOTIFICATION_CHANNEL)).nonempty().optional(),
  dedupeKey: z.string().min(1).max(256).optional(),
  scheduledFor: z.coerce.date().optional(),
  locale: z.string().min(2).max(16).optional(),
})
export type SendNotificationBody = z.infer<typeof sendNotificationSchema>

export const registerDeviceSchema = z.object({
  platform: z.nativeEnum(DEVICE_PLATFORM),
  driver: z.nativeEnum(PUSH_DRIVER),
  token: z.string().min(1).max(4096),
  appVersion: z.string().max(32).optional(),
  locale: z.string().min(2).max(16).optional(),
  timezone: z.string().min(1).max(64).optional(),
})
export type RegisterDeviceBody = z.infer<typeof registerDeviceSchema>

export const preferenceEntrySchema = z.object({
  category: z.string().min(1).max(64),
  channel: z.nativeEnum(NOTIFICATION_CHANNEL),
  enabled: z.boolean(),
  ...quietHoursShape,
})

export const updatePreferencesSchema = z.object({
  preferences: z.array(preferenceEntrySchema).max(200),
})
export type UpdatePreferencesBody = z.infer<typeof updatePreferencesSchema>

export const categoryPolicyEntrySchema = z.object({
  category: z.string().min(1).max(64),
  channel: z.nativeEnum(NOTIFICATION_CHANNEL),
  enabled: z.boolean(),
})

export const updateCategoryPoliciesSchema = z.object({
  policies: z.array(categoryPolicyEntrySchema).max(500),
})
export type UpdateCategoryPoliciesBody = z.infer<typeof updateCategoryPoliciesSchema>

export const upsertTemplateSchema = z.object({
  key: z.string().min(1).max(128),
  channel: z.nativeEnum(NOTIFICATION_CHANNEL),
  locale: z.string().min(2).max(16),
  subject: z.string().max(256).optional(),
  body: z.string().min(1).max(8192),
  whatsappTemplateName: z.string().max(128).optional(),
  active: z.boolean().default(true),
})
export type UpsertTemplateBody = z.infer<typeof upsertTemplateSchema>

/** Query string chega sempre como texto — daí o `coerce` e o booleano por literal. */
export const listNotificationsQuerySchema = z.object({
  category: z.string().min(1).max(64).optional(),
  read: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  cursor: z.string().max(512).optional(),
  perPage: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(20),
})
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>

/**
 * Forma normalizada do recibo de entrega, depois que o parser do driver traduziu o payload do
 * provedor. A verificação de assinatura acontece antes disto, sobre o `rawBody`.
 */
export const deliveryWebhookSchema = z.object({
  providerMessageId: z.string().min(1),
  status: z.enum(['delivered', 'bounced', 'failed']),
  errorCode: z.string().max(64).optional(),
  occurredAt: z.coerce.date(),
  suppressionReason: z.nativeEnum(SUPPRESSION_REASON).optional(),
})
export type DeliveryWebhookBody = z.infer<typeof deliveryWebhookSchema>
