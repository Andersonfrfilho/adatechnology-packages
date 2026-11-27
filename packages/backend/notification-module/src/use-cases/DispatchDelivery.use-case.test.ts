/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'

import { createDefaultTemplateRenderer } from '../shared/DefaultTemplateRenderer'
import {
  buildTemplateRow,
  createInMemoryDeliveries,
  createInMemoryDevices,
  createInMemoryNotifications,
  createInMemorySuppressions,
  createInMemoryTemplates,
  createRecordingQueue,
} from '../testing/inMemoryRepositories'
import { createInMemoryEmailDriver } from '../testing'
import { DispatchDeliveryUseCase } from './DispatchDelivery.use-case'

const COMPANY_ID = randomUUID()
const USER_ID = randomUUID()

describe('DispatchDeliveryUseCase — e-mail', () => {
  it('manda a chave do modelo como tag `template` para o driver', async () => {
    const notifications = createInMemoryNotifications()
    const deliveries = createInMemoryDeliveries()
    const email = createInMemoryEmailDriver()
    const notification = await notifications.create({
      companyId: COMPANY_ID,
      recipientUserId: USER_ID,
      category: 'order_status',
      templateKey: 'order.shipped',
      title: 'Pedido enviado',
      body: 'Seu pedido saiu',
    })
    const delivery = await deliveries.create({
      notificationId: notification.id,
      companyId: COMPANY_ID,
      channel: 'email',
      deviceId: null,
      driver: null,
      attempt: 0,
      status: 'queued',
    })
    const templates = createInMemoryTemplates([
      buildTemplateRow({
        companyId: COMPANY_ID,
        key: 'order.shipped',
        channel: 'email',
        locale: 'pt-BR',
        subject: 'Enviado',
        body: 'Olá',
      }),
    ])

    const useCase = new DispatchDeliveryUseCase(
      {
        notifications,
        deliveries,
        templates,
        devices: createInMemoryDevices([]),
        suppressions: createInMemorySuppressions([]),
        queue: createRecordingQueue(),
        recipientResolver: { resolve: async () => ({ userId: USER_ID, email: 'cliente@example.com' }) },
        templateRenderer: createDefaultTemplateRenderer(),
        channels: { email },
      } as never,
      { defaultLocale: 'pt-BR', suppressionHmacKey: 'chave', retryAttempts: 3, retryBackoffSeconds: 30 },
    )

    await useCase.execute({
      notificationId: notification.id,
      deliveryId: delivery.id,
      companyId: COMPANY_ID,
      channel: 'email',
      attempt: 0,
    })

    expect(email.sent).toHaveLength(1)
    expect(email.sent[0]?.tags).toEqual({ template: 'order.shipped' })
  })
})
