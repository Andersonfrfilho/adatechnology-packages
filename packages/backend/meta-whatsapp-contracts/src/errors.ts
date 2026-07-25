// Hierarquia de erros do módulo — não depende do framework de erros do host (nenhum DomainError
// importado); o host mapeia estes para o seu próprio formato de resposta no exception filter.
export class MetaWhatsAppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'MetaWhatsAppError'
  }
}

export const META_WHATSAPP_ERROR_CODES = {
  WINDOW_EXPIRED: 'META_WHATSAPP_WINDOW_EXPIRED',
  INVALID_SIGNATURE: 'META_WHATSAPP_INVALID_SIGNATURE',
  DUPLICATE_DELIVERY: 'META_WHATSAPP_DUPLICATE_DELIVERY',
  CONFIG_MISSING: 'META_WHATSAPP_CONFIG_MISSING',
  TEMPLATE_NOT_CONFIGURED: 'META_WHATSAPP_TEMPLATE_NOT_CONFIGURED',
  SESSION_NOT_FOUND: 'META_WHATSAPP_SESSION_NOT_FOUND',
} as const

export class WindowExpiredError extends MetaWhatsAppError {
  constructor(public readonly hoursSinceLastMessage?: number) {
    super(
      'Janela de 24h expirada — não é possível enviar mensagem para este contato fora de template.',
      400,
      META_WHATSAPP_ERROR_CODES.WINDOW_EXPIRED,
      { hoursSinceLastMessage },
    )
  }
}

// Assinatura HMAC do webhook não confere — Meta ou um terceiro tentando forjar uma entrega.
export class InvalidWebhookSignatureError extends MetaWhatsAppError {
  constructor() {
    super('Assinatura do webhook inválida.', 401, META_WHATSAPP_ERROR_CODES.INVALID_SIGNATURE)
  }
}

// Meta reenviou uma entrega dentro da janela de replay (nonce já visto) — não é erro do
// cliente, é comportamento esperado da Cloud API; o host deve responder 200 e ignorar.
export class DuplicateWebhookDeliveryError extends MetaWhatsAppError {
  constructor(nonce: string) {
    super('Entrega de webhook duplicada.', 409, META_WHATSAPP_ERROR_CODES.DUPLICATE_DELIVERY, { nonce })
  }
}

export class ConfigMissingError extends MetaWhatsAppError {
  constructor(missingField: string) {
    super(`Configuração do WhatsApp ausente: ${missingField}.`, 503, META_WHATSAPP_ERROR_CODES.CONFIG_MISSING, {
      missingField,
    })
  }
}

export class TemplateNotConfiguredError extends MetaWhatsAppError {
  constructor() {
    super(
      'Nenhum template de WhatsApp configurado para reabertura de janela.',
      503,
      META_WHATSAPP_ERROR_CODES.TEMPLATE_NOT_CONFIGURED,
    )
  }
}

export class SessionNotFoundError extends MetaWhatsAppError {
  constructor(whatsappNumber: string) {
    super(
      `Sessão de conversa não encontrada para ${whatsappNumber}.`,
      404,
      META_WHATSAPP_ERROR_CODES.SESSION_NOT_FOUND,
      { whatsappNumber },
    )
  }
}
