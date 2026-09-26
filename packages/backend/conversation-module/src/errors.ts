/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Hierarquia autocontida (molde `notification-contracts/errors.ts`): um pacote publicado não
 * importa o `DomainError` do host. O host mapeia estes erros no exception filter dele.
 */
import type { ConversationChannel } from '@adatechnology/conversation-contracts'

export class ConversationModuleError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ConversationModuleError'
  }
}

export const CONVERSATION_ERROR_CODES = {
  CHANNEL_NOT_CONFIGURED: 'CONVERSATION_CHANNEL_NOT_CONFIGURED',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'CONVERSATION_MESSAGE_NOT_FOUND',
  CONFIG_MISSING: 'CONVERSATION_CONFIG_MISSING',
  ATTACHMENTS_DISABLED: 'CONVERSATION_ATTACHMENTS_DISABLED',
  ATTACHMENT_TYPE_MISMATCH: 'CONVERSATION_ATTACHMENT_TYPE_MISMATCH',
  ATTACHMENT_TOO_LARGE: 'CONVERSATION_ATTACHMENT_TOO_LARGE',
  UPLOAD_NOT_FOUND: 'CONVERSATION_UPLOAD_NOT_FOUND',
  UPLOAD_EXPIRED: 'CONVERSATION_UPLOAD_EXPIRED',
  UNASSIGNED_NOT_FOUND: 'CONVERSATION_UNASSIGNED_NOT_FOUND',
  ATTACHMENT_NOT_FOUND: 'CONVERSATION_ATTACHMENT_NOT_FOUND',
  CHANNEL_TRANSPORT_MISSING: 'CONVERSATION_CHANNEL_TRANSPORT_MISSING',
  QUICK_REPLY_INVALID: 'CONVERSATION_QUICK_REPLY_INVALID',
  QUICK_REPLY_NOT_FOUND: 'CONVERSATION_QUICK_REPLY_NOT_FOUND',
} as const

/**
 * Canal sem `ConversationChannelPort` injetado em `providers.channels` — porta ausente desliga o
 * recurso (ADR-0051 §4): enviar por um canal sem porta é erro de domínio claro, nunca silencioso.
 */
export class ChannelPortNotConfiguredError extends ConversationModuleError {
  constructor(public readonly channel: ConversationChannel) {
    super(
      `Canal sem porta de envio configurada — injete providers.channels.${channel} ou não envie por este canal.`,
      500,
      CONVERSATION_ERROR_CODES.CHANNEL_NOT_CONFIGURED,
      { channel },
    )
  }
}

/**
 * D5, CA03: canal com `requiresTransport: true` (RF2) pedido em `config.enabledChannels` sem a
 * porta de transporte correspondente na subida — canal que aceita mensagem e perde a resposta é
 * pior que canal desligado.
 */
export class ChannelTransportMissingError extends ConversationModuleError {
  constructor(
    public readonly channel: ConversationChannel,
    public readonly transportPortName: string,
  ) {
    super(
      `Canal ${channel} pedido em enabledChannels sem transporte — injete a porta ${transportPortName} para ligar este canal.`,
      500,
      CONVERSATION_ERROR_CODES.CHANNEL_TRANSPORT_MISSING,
      { channel, transportPortName },
    )
  }
}

export class ConversationNotFoundError extends ConversationModuleError {
  constructor(public readonly conversationId: string) {
    super(`Conversa não encontrada.`, 404, CONVERSATION_ERROR_CODES.CONVERSATION_NOT_FOUND, { conversationId })
  }
}

export class MessageNotFoundError extends ConversationModuleError {
  constructor(public readonly messageId: string) {
    super(`Mensagem não encontrada.`, 404, CONVERSATION_ERROR_CODES.MESSAGE_NOT_FOUND, { messageId })
  }
}

/** Configuração obrigatória ausente — falha no boot (mesmo racional de `ConfigMissingError` do notification-module). */
export class ConfigMissingError extends ConversationModuleError {
  constructor(public readonly field: string) {
    super(`Configuração obrigatória ausente: ${field}.`, 500, CONVERSATION_ERROR_CODES.CONFIG_MISSING, { field })
  }
}

/** `providers.objectStorage` ausente — anexo desligado (RF8, ADR-0051 §4). */
export class AttachmentsDisabledError extends ConversationModuleError {
  constructor() {
    super(
      `Anexo desligado — injete providers.objectStorage para habilitar upload e download de anexo.`,
      500,
      CONVERSATION_ERROR_CODES.ATTACHMENTS_DISABLED,
    )
  }
}

/** O tipo declarado (extensão/`content-type`) não bate com a assinatura de bytes do conteúdo. */
export class AttachmentTypeMismatchError extends ConversationModuleError {
  constructor(
    public readonly declaredContentType: string,
    public readonly detectedContentType: string | undefined,
  ) {
    super(
      `O conteúdo do anexo não corresponde ao tipo declarado.`,
      422,
      CONVERSATION_ERROR_CODES.ATTACHMENT_TYPE_MISMATCH,
      { declaredContentType, detectedContentType },
    )
  }
}

export class AttachmentTooLargeError extends ConversationModuleError {
  constructor(
    public readonly sizeBytes: number,
    public readonly maxBytes: number,
  ) {
    super(`Anexo maior que o teto do canal.`, 413, CONVERSATION_ERROR_CODES.ATTACHMENT_TOO_LARGE, {
      sizeBytes,
      maxBytes,
    })
  }
}

export class UploadNotFoundError extends ConversationModuleError {
  constructor(public readonly objectKey: string) {
    super(`Pedido de upload não encontrado.`, 404, CONVERSATION_ERROR_CODES.UPLOAD_NOT_FOUND, { objectKey })
  }
}

export class UploadExpiredError extends ConversationModuleError {
  constructor(public readonly objectKey: string) {
    super(`Pedido de upload expirado.`, 410, CONVERSATION_ERROR_CODES.UPLOAD_EXPIRED, { objectKey })
  }
}

export class UnassignedNotFoundError extends ConversationModuleError {
  constructor(public readonly unassignedId: string) {
    super(`Item da fila de não atribuídas não encontrado.`, 404, CONVERSATION_ERROR_CODES.UNASSIGNED_NOT_FOUND, {
      unassignedId,
    })
  }
}

export class AttachmentNotFoundError extends ConversationModuleError {
  constructor(public readonly attachmentId: string) {
    super(`Anexo não encontrado.`, 404, CONVERSATION_ERROR_CODES.ATTACHMENT_NOT_FOUND, { attachmentId })
  }
}

/** Texto em branco ou acima de 500 caracteres. */
export class QuickReplyInvalidError extends ConversationModuleError {
  constructor() {
    super(
      `Texto da resposta rápida inválido — deve ter entre 1 e 500 caracteres.`,
      422,
      CONVERSATION_ERROR_CODES.QUICK_REPLY_INVALID,
    )
  }
}

export class QuickReplyNotFoundError extends ConversationModuleError {
  constructor(public readonly quickReplyId: string) {
    super(`Resposta rápida não encontrada.`, 404, CONVERSATION_ERROR_CODES.QUICK_REPLY_NOT_FOUND, { quickReplyId })
  }
}
