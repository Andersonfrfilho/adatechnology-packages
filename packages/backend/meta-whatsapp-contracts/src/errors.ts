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
  AUDIO_NOT_INGESTED: 'META_WHATSAPP_AUDIO_NOT_INGESTED',
  MESSAGE_NOT_AUDIO: 'META_WHATSAPP_MESSAGE_NOT_AUDIO',
  TRANSCRIPTION_DISABLED: 'META_WHATSAPP_TRANSCRIPTION_DISABLED',
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

/**
 * Pediram transcrição de um áudio que ainda não foi copiado da Meta para o storage.
 *
 * 409 e não 404: a mensagem existe e o áudio vai chegar — a ingestão é assíncrona e o atendente
 * simplesmente clicou antes de ela terminar. É o único erro de transcrição em que "tente de novo em
 * alguns segundos" é a orientação correta para a interface.
 */
export class AudioNotIngestedError extends MetaWhatsAppError {
  constructor(messageId: string) {
    super(
      'Áudio ainda está sendo copiado — tente novamente em alguns segundos.',
      409,
      META_WHATSAPP_ERROR_CODES.AUDIO_NOT_INGESTED,
      { messageId },
    )
  }
}

/**
 * Transcrição está desligada para esta empresa.
 *
 * Guarda de última linha, não o caminho normal: o painel lê as configurações e nem desenha o botão
 * quando está desligado. Existe para o caso de a tela estar com dado velho, ou de alguém chamar a
 * rota direto — e é `409` (estado atual conflita com a operação), não `403`: ninguém está sem
 * permissão, o recurso está desligado por escolha e liga a qualquer momento.
 */
export class TranscriptionDisabledError extends MetaWhatsAppError {
  constructor() {
    super(
      'Transcrição de áudio está desligada para esta empresa.',
      409,
      META_WHATSAPP_ERROR_CODES.TRANSCRIPTION_DISABLED,
    )
  }
}

/** Pediram transcrição de mensagem que não é áudio. Nunca melhora com retentativa. */
export class MessageNotAudioError extends MetaWhatsAppError {
  constructor(messageId: string, type: string) {
    super(
      `Mensagem ${messageId} é do tipo "${type}" — só áudio é transcrito.`,
      422,
      META_WHATSAPP_ERROR_CODES.MESSAGE_NOT_AUDIO,
      { messageId, type },
    )
  }
}
