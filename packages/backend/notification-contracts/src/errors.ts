/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { NotificationChannel } from './notification.types'

/**
 * Hierarquia autocontida: um pacote publicado não importa o `DomainError` do host. O host mapeia
 * estes erros no seu exception filter — e o próprio módulo já traz um, para o consumidor das rotas
 * não precisar escrever `try/catch` por endpoint.
 */
export class NotificationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'NotificationError'
  }
}

export const NOTIFICATION_ERROR_CODES = {
  TEMPLATE_NOT_FOUND: 'NOTIFICATION_TEMPLATE_NOT_FOUND',
  CHANNEL_NOT_CONFIGURED: 'NOTIFICATION_CHANNEL_NOT_CONFIGURED',
  RECIPIENT_UNRESOLVED: 'NOTIFICATION_RECIPIENT_UNRESOLVED',
  SUPPRESSED_TARGET: 'NOTIFICATION_SUPPRESSED_TARGET',
  NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  INVALID_WEBHOOK_SIGNATURE: 'NOTIFICATION_INVALID_WEBHOOK_SIGNATURE',
  DUPLICATE_WEBHOOK_DELIVERY: 'NOTIFICATION_DUPLICATE_WEBHOOK_DELIVERY',
  DEVICE_NOT_FOUND: 'NOTIFICATION_DEVICE_NOT_FOUND',
  THROTTLED: 'NOTIFICATION_THROTTLED',
  CONFIG_MISSING: 'NOTIFICATION_CONFIG_MISSING',
} as const

export class TemplateNotFoundError extends NotificationError {
  constructor(
    public readonly templateKey: string,
    public readonly channel: NotificationChannel,
    public readonly locale: string,
  ) {
    super(
      `Template não encontrado para a chave informada neste canal e locale.`,
      404,
      NOTIFICATION_ERROR_CODES.TEMPLATE_NOT_FOUND,
      { templateKey, channel, locale },
    )
  }
}

/** Canal ligado em `features` sem driver injetado — erro de composição, detectado no boot. */
export class ChannelNotConfiguredError extends NotificationError {
  constructor(public readonly channel: NotificationChannel) {
    super(
      `Canal habilitado sem driver injetado — injete o driver em providers.channels ou desligue a feature.`,
      500,
      NOTIFICATION_ERROR_CODES.CHANNEL_NOT_CONFIGURED,
      { channel },
    )
  }
}

/**
 * `RecipientResolverPort` não devolveu endereço para o canal. Mensagem sem PII de propósito: o
 * `userId` é identificador opaco, o e-mail ou telefone jamais entra no erro (`security.md` §1).
 */
export class RecipientUnresolvedError extends NotificationError {
  constructor(
    public readonly userId: string,
    public readonly channel: NotificationChannel,
  ) {
    super(`Destinatário sem endereço utilizável para este canal.`, 422, NOTIFICATION_ERROR_CODES.RECIPIENT_UNRESOLVED, {
      userId,
      channel,
    })
  }
}

export class SuppressedTargetError extends NotificationError {
  constructor(
    public readonly channel: NotificationChannel,
    public readonly reason: string,
  ) {
    super(`Endereço suprimido para este canal — envio bloqueado.`, 409, NOTIFICATION_ERROR_CODES.SUPPRESSED_TARGET, {
      channel,
      reason,
    })
  }
}

/**
 * Também é a resposta para notificação de OUTRO usuário: devolver 404 em vez de 403 não revela a
 * existência do recurso a quem não pode vê-lo (BOLA/API1).
 */
export class NotificationNotFoundError extends NotificationError {
  constructor(public readonly notificationId: string) {
    super(`Notificação não encontrada.`, 404, NOTIFICATION_ERROR_CODES.NOT_FOUND, { notificationId })
  }
}

export class InvalidWebhookSignatureError extends NotificationError {
  constructor() {
    super(`Assinatura do webhook inválida.`, 401, NOTIFICATION_ERROR_CODES.INVALID_WEBHOOK_SIGNATURE)
  }
}

/** Recibo reenviado dentro da janela de replay (nonce já visto) — não é erro, é ruído esperado. */
export class DuplicateWebhookDeliveryError extends NotificationError {
  constructor(public readonly nonce: string) {
    super(`Entrega de webhook duplicada.`, 200, NOTIFICATION_ERROR_CODES.DUPLICATE_WEBHOOK_DELIVERY, { nonce })
  }
}

export class DeviceNotFoundError extends NotificationError {
  constructor(public readonly deviceId: string) {
    super(`Dispositivo não encontrado.`, 404, NOTIFICATION_ERROR_CODES.DEVICE_NOT_FOUND, { deviceId })
  }
}

export class ThrottledError extends NotificationError {
  constructor(
    public readonly channel: NotificationChannel,
    public readonly retryAfterSeconds: number,
  ) {
    super(`Limite de envios para este destinatário atingido.`, 429, NOTIFICATION_ERROR_CODES.THROTTLED, {
      channel,
      retryAfterSeconds,
    })
  }
}

/** Configuração obrigatória ausente (chave de HMAC, segredo de webhook) — falha no boot. */
export class ConfigMissingError extends NotificationError {
  constructor(public readonly field: string) {
    super(`Configuração obrigatória ausente.`, 500, NOTIFICATION_ERROR_CODES.CONFIG_MISSING, { field })
  }
}
