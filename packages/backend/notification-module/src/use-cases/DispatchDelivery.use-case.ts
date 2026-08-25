/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Consome UM job da fila — uma `delivery` específica, não "a notificação" (push cria uma por
 * device). Idempotente por `delivery.status`: um job duplicado numa fila at-least-once encontra
 * a delivery já fora de `queued` e não faz nada de novo.
 */

import { NOTIFICATION_CHANNEL } from '@adatechnology/notification-contracts'
import type {
  DeliveryAttemptResult,
  NotificationChannel,
  NotificationJob,
  SendEmailParams,
  SendPushParams,
  SendSmsParams,
  SendWhatsAppParams,
} from '@adatechnology/notification-contracts'

import { applyDeliveryOutcome } from './applyDeliveryOutcome'
import { resolveEmailAttachments } from './resolveEmailAttachments'
import type { DispatchDeliveryConfig, DispatchDeliveryDependencies } from './dispatchDelivery.types'

function permanentOutcome(errorCode: string): DeliveryAttemptResult {
  return { outcome: 'permanent', errorCode }
}

export class DispatchDeliveryUseCase {
  constructor(
    private readonly dependencies: DispatchDeliveryDependencies,
    private readonly config: DispatchDeliveryConfig,
  ) {}

  async execute(job: NotificationJob): Promise<void> {
    const now = this.dependencies.clock?.now() ?? new Date()

    const delivery = await this.dependencies.deliveries.findById({ companyId: job.companyId, id: job.deliveryId })
    if (!delivery) {
      this.dependencies.logger?.warn('notification.dispatch_delivery.not_found', { deliveryId: job.deliveryId })
      return
    }
    if (delivery.status !== 'queued') return // já processada — job duplicado da fila

    const notification = await this.dependencies.notifications.findByIdForCompany({
      companyId: job.companyId,
      id: job.notificationId,
    })
    if (!notification) {
      this.dependencies.logger?.warn('notification.dispatch_delivery.notification_not_found', {
        notificationId: job.notificationId,
      })
      return
    }

    const recipient = await this.dependencies.recipientResolver.resolve({
      userId: notification.recipientUserId,
      companyId: job.companyId,
    })
    if (!recipient) {
      await applyDeliveryOutcome({
        dependencies: this.dependencies,
        config: this.config,
        delivery,
        notification,
        outcome: permanentOutcome('recipient_unresolved'),
        now,
      })
      return
    }

    const locale = recipient.locale ?? this.config.defaultLocale
    const template = await this.dependencies.templates.findActive({
      companyId: job.companyId,
      key: notification.templateKey,
      channel: delivery.channel,
      locale,
    })
    if (!template) {
      await applyDeliveryOutcome({
        dependencies: this.dependencies,
        config: this.config,
        delivery,
        notification,
        outcome: permanentOutcome('template_not_found'),
        now,
      })
      return
    }

    const rendered = await this.dependencies.templateRenderer.render({
      body: template.body,
      subject: template.subject ?? undefined,
      channel: delivery.channel as NotificationChannel,
      payload: notification.payload,
      locale,
    })

    const address = delivery.channel === NOTIFICATION_CHANNEL.EMAIL ? recipient.email : recipient.phone
    const { outcome, resolvedAddress } = await this.sendThroughDriver({
      delivery,
      rendered,
      recipient,
      template,
      notification: { templateKey: notification.templateKey, payload: notification.payload },
      address,
    })

    await applyDeliveryOutcome({
      dependencies: this.dependencies,
      config: this.config,
      delivery,
      notification,
      outcome,
      address: resolvedAddress,
      now,
    })
  }

  private async sendThroughDriver(params: {
    delivery: { id: string; channel: string; deviceId: string | null }
    rendered: { title: string; body: string; html?: string }
    recipient: { email?: string; phone?: string }
    template: { whatsappTemplateName?: string | null }
    /** Chave e payload da notificação: é o par que descobre quais valores são anexo. */
    notification: { templateKey: string; payload: Readonly<Record<string, unknown>> }
    address?: string
  }): Promise<{ outcome: DeliveryAttemptResult; resolvedAddress?: string }> {
    const { delivery, rendered, recipient, template, notification, address } = params

    if (delivery.channel === NOTIFICATION_CHANNEL.PUSH) {
      if (!delivery.deviceId) return { outcome: permanentOutcome('device_unavailable') }
      const device = await this.dependencies.devices.findById({ id: delivery.deviceId })
      if (!device || device.disabledAt) return { outcome: permanentOutcome('device_unavailable') }
      if (!this.dependencies.channels.push) return { outcome: permanentOutcome('channel_not_configured') }

      const sendPushParams: SendPushParams = {
        token: device.token,
        platform: device.platform as SendPushParams['platform'],
        title: rendered.title,
        body: rendered.body,
      }
      return { outcome: await this.dependencies.channels.push.send(sendPushParams) }
    }

    if (delivery.channel === NOTIFICATION_CHANNEL.EMAIL) {
      if (!recipient.email) return { outcome: permanentOutcome('recipient_unresolved') }
      if (!this.dependencies.channels.email) return { outcome: permanentOutcome('channel_not_configured') }

      /**
       * Só a REFERÊNCIA segue para o driver — é ele que baixa, na hora de montar o MIME. Os bytes
       * não passam por aqui de propósito: este processo pode nem chegar a enviar, e carregar 25MB
       * para descobrir isso é desperdício num processo que atende outras entregas junto.
       */
      const attachments = resolveEmailAttachments({
        payload: notification.payload,
        variables: this.config.templateVariables?.[notification.templateKey],
      })

      const sendEmailParams: SendEmailParams = {
        to: recipient.email,
        subject: rendered.title,
        html: rendered.html ?? rendered.body,
        text: rendered.body,
        ...(attachments.length > 0 ? { attachments } : {}),
      }

      if (attachments.length > 0) {
        /**
         * Nome e tipo, nunca a URL: ela é assinada, e assinatura em log é credencial em log
         * (`security.md` §1). O nome do arquivo pode ser pessoal, então ele também fica de fora —
         * o que se registra é quantos e de que tipo.
         */
        this.dependencies.logger?.info('notification.dispatch_delivery.attachments', {
          deliveryId: delivery.id,
          count: attachments.length,
          contentTypes: [...new Set(attachments.map((attachment) => attachment.contentType))],
        })
      }

      return { outcome: await this.dependencies.channels.email.send(sendEmailParams), resolvedAddress: address }
    }

    if (delivery.channel === NOTIFICATION_CHANNEL.WHATSAPP) {
      if (!recipient.phone) return { outcome: permanentOutcome('recipient_unresolved') }
      if (!this.dependencies.channels.whatsapp) return { outcome: permanentOutcome('channel_not_configured') }

      const sendWhatsAppParams: SendWhatsAppParams = {
        to: recipient.phone,
        body: rendered.body,
        template: template.whatsappTemplateName
          ? { templateName: template.whatsappTemplateName, languageCode: 'pt_BR' }
          : undefined,
      }
      return { outcome: await this.dependencies.channels.whatsapp.send(sendWhatsAppParams), resolvedAddress: address }
    }

    if (delivery.channel === NOTIFICATION_CHANNEL.SMS) {
      if (!recipient.phone) return { outcome: permanentOutcome('recipient_unresolved') }
      if (!this.dependencies.channels.sms) return { outcome: permanentOutcome('channel_not_configured') }

      const sendSmsParams: SendSmsParams = { to: recipient.phone, body: rendered.body }
      return { outcome: await this.dependencies.channels.sms.send(sendSmsParams), resolvedAddress: address }
    }

    return { outcome: permanentOutcome(`unknown_channel_${delivery.channel}`) }
  }
}
