/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Envio, dispositivos, preferências, templates e recibo de webhook.
 */

import {
  DuplicateWebhookDeliveryError,
  InvalidWebhookSignatureError,
  deliveryWebhookSchema,
  registerDeviceSchema,
  sendNotificationSchema,
  updatePreferencesSchema,
  upsertTemplateSchema,
} from '@adatechnology/notification-contracts'
import type { ModuleRoute } from '@adatechnology/module-http'

import type { NotificationModule } from '../NotificationModule'
import { claimNotificationWebhookDelivery, verifyNotificationWebhookSignature } from '../shared/webhookSecurity'
import { requireUser } from './requireUser'

export function buildManagementRoutes(params: { module: NotificationModule; webhookSecret?: string }): ModuleRoute[] {
  const { useCases, cache, clock } = params.module

  return [
    {
      method: 'POST',
      path: '/notifications',
      scope: 'service',
      bodySchema: sendNotificationSchema,
      operationId: 'sendNotification',
      summary: 'Dispara uma notificação para um destinatário',
      async handler(context) {
        const body = context.body as {
          recipientUserId: string
          category: string
          templateKey: string
          payload?: Record<string, unknown>
          channels?: string[]
          dedupeKey?: string
          scheduledFor?: Date
          locale?: string
        }

        // `Idempotency-Key` do header é aceito como `dedupeKey` quando o corpo não traz um —
        // é o mesmo conceito por dois caminhos (`apis.md`, idempotência em POST).
        const dedupeKey = body.dedupeKey ?? context.headers['idempotency-key']

        const result = await useCases.sendNotification.execute({
          // companyId SEMPRE do contexto autenticado, nunca do corpo (database.md, multiempresa).
          companyId: context.auth?.companyId ?? '',
          recipientUserId: body.recipientUserId,
          category: body.category,
          templateKey: body.templateKey,
          payload: body.payload,
          channels: body.channels as never,
          dedupeKey,
          scheduledFor: body.scheduledFor,
          locale: body.locale,
        })

        // 200 (não 201) quando a idempotência devolveu o existente — `apis.md`.
        return { kind: 'json', status: result.deduplicated ? 200 : 201, body: { data: result } }
      },
    },

    {
      method: 'POST',
      path: '/notification-devices',
      scope: 'user',
      bodySchema: registerDeviceSchema,
      operationId: 'registerDevice',
      summary: 'Registra ou reativa um dispositivo para push',
      async handler(context) {
        const auth = requireUser(context)
        const body = context.body as {
          platform: 'ios' | 'android' | 'web'
          driver: 'expo' | 'fcm'
          token: string
          appVersion?: string
          locale?: string
          timezone?: string
        }

        const device = await useCases.registerDevice.execute({
          companyId: auth.companyId,
          userId: auth.userId,
          ...body,
        })
        return { kind: 'json', status: 201, body: { data: device } }
      },
    },

    {
      method: 'DELETE',
      path: '/notification-devices/:id',
      scope: 'user',
      operationId: 'unregisterDevice',
      summary: 'Remove um dispositivo registrado',
      async handler(context) {
        const auth = requireUser(context)
        await useCases.unregisterDevice.execute({
          companyId: auth.companyId,
          userId: auth.userId,
          id: context.params.id ?? '',
        })
        return { kind: 'empty', status: 204 }
      },
    },

    {
      method: 'GET',
      path: '/notification-preferences',
      scope: 'user',
      operationId: 'getNotificationPreferences',
      summary: 'Preferências de canal do usuário autenticado',
      async handler(context) {
        const auth = requireUser(context)
        const preferences = await useCases.getPreferences.execute({
          companyId: auth.companyId,
          userId: auth.userId,
        })
        return { kind: 'json', status: 200, body: { data: preferences } }
      },
    },

    {
      method: 'PUT',
      path: '/notification-preferences',
      scope: 'user',
      bodySchema: updatePreferencesSchema,
      operationId: 'updateNotificationPreferences',
      summary: 'Atualiza preferências de canal em lote',
      async handler(context) {
        const auth = requireUser(context)
        const body = context.body as { preferences: { category: string; channel: string; enabled: boolean }[] }
        const preferences = await useCases.updatePreferences.execute({
          companyId: auth.companyId,
          userId: auth.userId,
          preferences: body.preferences,
        })
        return { kind: 'json', status: 200, body: { data: preferences } }
      },
    },

    {
      method: 'GET',
      path: '/notification-templates',
      scope: 'admin',
      operationId: 'listNotificationTemplates',
      summary: 'Lista os templates da empresa',
      async handler(context) {
        const templates = await useCases.listTemplates.execute({ companyId: context.auth?.companyId ?? '' })
        return { kind: 'json', status: 200, body: { data: templates } }
      },
    },

    {
      method: 'POST',
      path: '/notification-templates',
      scope: 'admin',
      bodySchema: upsertTemplateSchema,
      operationId: 'createNotificationTemplate',
      summary: 'Cria uma nova versão de template',
      async handler(context) {
        const template = await useCases.upsertTemplate.execute({
          companyId: context.auth?.companyId ?? '',
          ...(context.body as never as { key: string; channel: string; locale: string; body: string; active: boolean }),
        })
        return { kind: 'json', status: 201, body: { data: template } }
      },
    },

    {
      method: 'POST',
      path: '/notification-webhooks/:driver',
      scope: 'public',
      bodySchema: deliveryWebhookSchema,
      operationId: 'receiveDeliveryReceipt',
      summary: 'Recebe recibo de entrega de um provedor',
      async handler(context) {
        // Fail-closed: sem segredo configurado a rota nem sobe (ver createNotificationRoutes),
        // mas se chegar aqui sem ele, recusa em vez de aceitar qualquer payload.
        if (!params.webhookSecret) throw new InvalidWebhookSignatureError()
        if (!context.rawBody) throw new InvalidWebhookSignatureError()

        verifyNotificationWebhookSignature({
          rawBody: Buffer.from(context.rawBody),
          signatureHeader: context.headers['x-notification-signature'],
          timestampHeader: context.headers['x-notification-timestamp'],
          secret: params.webhookSecret,
          now: clock?.now(),
        })

        if (cache) {
          const signature = context.headers['x-notification-signature'] ?? ''
          const claimed = await claimNotificationWebhookDelivery({
            cache,
            driver: context.params.driver ?? 'unknown',
            nonce: signature,
          })
          // Replay dentro da janela — 200 porque não é erro do provedor, e responder 4xx faria
          // ele reenviar em loop.
          if (!claimed) throw new DuplicateWebhookDeliveryError(signature)
        }

        const receipt = context.body as {
          providerMessageId: string
          status: 'delivered' | 'bounced' | 'failed'
          errorCode?: string
          occurredAt: Date
          suppressionReason?: 'bounce' | 'complaint' | 'opt_out'
        }

        await useCases.receiveDeliveryReceipt.execute({
          channel: context.params.channel ?? inferChannelFromDriver(context.params.driver),
          receipt,
        })
        return { kind: 'empty', status: 204 }
      },
    },
  ]
}

// Os drivers de e-mail são os únicos que emitem recibo assíncrono hoje (spec §11); um driver
// desconhecido cai em `email` porque é o único canal com webhook implementado — se um dia
// WhatsApp emitir status por esta rota, entra aqui explicitamente.
function inferChannelFromDriver(driver: string | undefined): string {
  if (driver === 'whatsapp') return 'whatsapp'
  return 'email'
}
