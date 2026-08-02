/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz do módulo. **Escopo desta fase (Fase 4):** devolve `{ useCases }` — as rotas
 * HTTP, o worker e os `schedules` de cron chegam na Fase 5, junto com a tabela de rotas
 * declarativa que os adaptadores `fetch`/`uws` vão consumir (spec §4, §7). Não é uma forma
 * reduzida por engano: `routes`/`worker`/`schedules` genuinamente não existem antes da Fase 5.
 */

import {
  ChannelNotConfiguredError,
  ConfigMissingError,
  type ChannelDrivers,
  type NotificationHooks,
} from '@adatechnology/notification-contracts'
import type {
  AuthContextResolverPort,
  CachePort,
  ClockPort,
  LoggerPort,
  QueuePort,
  RealtimeNotifierPort,
  RecipientResolverPort,
  TemplateRendererPort,
} from '@adatechnology/notification-contracts'

import type { NotificationDatabase } from './database.types'
import { DeliveryRepository } from './repositories/DeliveryRepository'
import { DeviceRepository } from './repositories/DeviceRepository'
import { NotificationRepository } from './repositories/NotificationRepository'
import { PreferenceRepository } from './repositories/PreferenceRepository'
import { SuppressionRepository } from './repositories/SuppressionRepository'
import { TemplateRepository } from './repositories/TemplateRepository'
import { createDefaultTemplateRenderer } from './shared/DefaultTemplateRenderer'
import { createInProcessQueue } from './shared/InProcessQueue'
import { createInProcessRealtimeNotifier } from './shared/InProcessRealtimeNotifier'
import {
  CountUnreadUseCase,
  DeleteNotificationUseCase,
  ListNotificationsUseCase,
  MarkAllAsReadUseCase,
  MarkAsReadUseCase,
} from './use-cases/Inbox.use-cases'
import {
  GetPreferencesUseCase,
  RegisterDeviceUseCase,
  UnregisterDeviceUseCase,
  UpdatePreferencesUseCase,
} from './use-cases/DeviceAndPreference.use-cases'
import { DispatchDeliveryUseCase } from './use-cases/DispatchDelivery.use-case'
import { DispatchDueNotificationsUseCase } from './use-cases/DispatchDueNotifications.use-case'
import { PurgeExpiredNotificationsUseCase } from './use-cases/PurgeExpiredNotifications.use-case'
import { ReceiveDeliveryReceiptUseCase } from './use-cases/ReceiveDeliveryReceipt.use-case'
import { SendNotificationUseCase } from './use-cases/SendNotification.use-case'
import {
  ListTemplatesUseCase,
  SeedDefaultTemplatesUseCase,
  UpsertTemplateUseCase,
} from './use-cases/Template.use-cases'

export type NotificationModuleFeatures = {
  readonly push?: boolean
  readonly email?: boolean
  readonly whatsapp?: boolean
  readonly sms?: boolean
}

export type NotificationModuleConfig = {
  readonly defaultLocale: string
  readonly defaultTimezone: string
  readonly retentionDays?: number
  readonly retry?: { readonly attempts: number; readonly backoffSeconds: number }
  readonly suppressionHmacKey: string
  readonly throttlePerHour?: Partial<Record<string, number>>
}

export type NotificationModuleProviders = {
  /** Obrigatória — o módulo não conhece a tabela de usuários do host (spec §6.2). */
  readonly recipientResolver: RecipientResolverPort
  readonly channels?: ChannelDrivers
  readonly queue?: QueuePort
  readonly cache?: CachePort
  readonly templateRenderer?: TemplateRendererPort
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
  /**
   * Omitido, o módulo usa o notificador em processo — que só entrega na mesma instância. Com
   * mais de uma réplica, injete um sobre o pub/sub do host (ver `RealtimeNotifierPort.subscribe`).
   */
  readonly realtime?: RealtimeNotifierPort
  /** Obrigatória quando as rotas HTTP estão montadas; sem ela, `createNotificationRoutes` falha. */
  readonly authContextResolver?: AuthContextResolverPort
}

export type CreateNotificationModuleParams = {
  readonly db: NotificationDatabase
  readonly config: NotificationModuleConfig
  readonly features?: NotificationModuleFeatures
  readonly providers: NotificationModuleProviders
  readonly hooks?: NotificationHooks
}

export type NotificationModule = {
  /** Reexpostas para a camada HTTP montar SSE, nonce de webhook e horário determinístico. */
  readonly realtime?: RealtimeNotifierPort
  readonly cache?: CachePort
  readonly clock?: ClockPort
  readonly useCases: {
    readonly sendNotification: SendNotificationUseCase
    readonly dispatchDelivery: DispatchDeliveryUseCase
    readonly dispatchDueNotifications: DispatchDueNotificationsUseCase
    readonly receiveDeliveryReceipt: ReceiveDeliveryReceiptUseCase
    readonly purgeExpiredNotifications: PurgeExpiredNotificationsUseCase
    readonly listNotifications: ListNotificationsUseCase
    readonly countUnread: CountUnreadUseCase
    readonly markAsRead: MarkAsReadUseCase
    readonly markAllAsRead: MarkAllAsReadUseCase
    readonly deleteNotification: DeleteNotificationUseCase
    readonly registerDevice: RegisterDeviceUseCase
    readonly unregisterDevice: UnregisterDeviceUseCase
    readonly getPreferences: GetPreferencesUseCase
    readonly updatePreferences: UpdatePreferencesUseCase
    readonly upsertTemplate: UpsertTemplateUseCase
    readonly listTemplates: ListTemplatesUseCase
    readonly seedDefaultTemplates: SeedDefaultTemplatesUseCase
  }
}

function assertFeaturePorts(features: NotificationModuleFeatures, channels: ChannelDrivers): void {
  if (features.push && !channels.push) throw new ChannelNotConfiguredError('push')
  if (features.email && !channels.email) throw new ChannelNotConfiguredError('email')
  if (features.whatsapp && !channels.whatsapp) throw new ChannelNotConfiguredError('whatsapp')
  if (features.sms && !channels.sms) throw new ChannelNotConfiguredError('sms')
}

export function createNotificationModule(params: CreateNotificationModuleParams): NotificationModule {
  if (!params.config.defaultLocale) throw new ConfigMissingError('defaultLocale')
  if (!params.config.defaultTimezone) throw new ConfigMissingError('defaultTimezone')
  if (!params.config.suppressionHmacKey) throw new ConfigMissingError('suppressionHmacKey')

  const features = params.features ?? {}
  const channels = params.providers.channels ?? {}
  assertFeaturePorts(features, channels)

  const notifications = new NotificationRepository(params.db)
  const deliveries = new DeliveryRepository(params.db)
  const devices = new DeviceRepository(params.db)
  const preferences = new PreferenceRepository(params.db)
  const templates = new TemplateRepository(params.db)
  const suppressions = new SuppressionRepository(params.db)

  const queue = params.providers.queue ?? createInProcessQueue()
  const templateRenderer = params.providers.templateRenderer ?? createDefaultTemplateRenderer()
  const realtime = params.providers.realtime ?? createInProcessRealtimeNotifier()

  const sharedDeps = {
    notifications,
    deliveries,
    templates,
    preferences,
    suppressions,
    devices,
    recipientResolver: params.providers.recipientResolver,
    templateRenderer,
    channels,
    queue,
    cache: params.providers.cache,
    clock: params.providers.clock,
    hooks: params.hooks,
    logger: params.providers.logger,
    realtime,
  }

  const sendNotification = new SendNotificationUseCase(sharedDeps, {
    defaultLocale: params.config.defaultLocale,
    suppressionHmacKey: params.config.suppressionHmacKey,
    throttlePerHour: params.config.throttlePerHour,
  })

  const dispatchDelivery = new DispatchDeliveryUseCase(sharedDeps, {
    defaultLocale: params.config.defaultLocale,
    suppressionHmacKey: params.config.suppressionHmacKey,
    retryAttempts: params.config.retry?.attempts ?? 5,
    retryBackoffSeconds: params.config.retry?.backoffSeconds ?? 30,
  })

  const upsertTemplate = new UpsertTemplateUseCase(templates)

  return {
    realtime,
    cache: params.providers.cache,
    clock: params.providers.clock,
    useCases: {
      sendNotification,
      dispatchDelivery,
      dispatchDueNotifications: new DispatchDueNotificationsUseCase({
        db: params.db,
        sendNotification,
        clock: params.providers.clock,
        logger: params.providers.logger,
      }),
      receiveDeliveryReceipt: new ReceiveDeliveryReceiptUseCase(
        {
          deliveries,
          notifications,
          suppressions,
          recipientResolver: params.providers.recipientResolver,
          hooks: params.hooks,
          logger: params.providers.logger,
        },
        { suppressionHmacKey: params.config.suppressionHmacKey },
      ),
      purgeExpiredNotifications: new PurgeExpiredNotificationsUseCase(
        { notifications, clock: params.providers.clock },
        { retentionDays: params.config.retentionDays },
      ),
      listNotifications: new ListNotificationsUseCase(notifications),
      countUnread: new CountUnreadUseCase(notifications),
      markAsRead: new MarkAsReadUseCase(notifications, params.hooks),
      markAllAsRead: new MarkAllAsReadUseCase(notifications),
      deleteNotification: new DeleteNotificationUseCase(notifications),
      registerDevice: new RegisterDeviceUseCase(devices, params.hooks),
      unregisterDevice: new UnregisterDeviceUseCase(devices),
      getPreferences: new GetPreferencesUseCase(preferences),
      updatePreferences: new UpdatePreferencesUseCase(preferences, params.hooks),
      upsertTemplate,
      listTemplates: new ListTemplatesUseCase(templates),
      seedDefaultTemplates: new SeedDefaultTemplatesUseCase(upsertTemplate),
    },
  }
}
