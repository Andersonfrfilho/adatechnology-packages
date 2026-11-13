export const META_GRAPH_ERROR_CODES = {
  CONFIG_MISSING: 'WHATSAPP_CONFIG_MISSING',
  NETWORK: 'WHATSAPP_NETWORK_ERROR',
  TIMEOUT: 'WHATSAPP_TIMEOUT',
  AUDIO_TRANSCODE_FAILED: 'WHATSAPP_AUDIO_TRANSCODE_FAILED',
  WINDOW_EXPIRED: 'WHATSAPP_WINDOW_EXPIRED',
  TEMPLATE_DUPLICATE: 'WHATSAPP_TEMPLATE_DUPLICATE',
  UNEXPECTED_RESPONSE: 'WHATSAPP_UNEXPECTED_RESPONSE',
} as const

export class MetaGraphError extends Error {
  readonly code: string
  readonly providerMessage: string
  readonly rawResponse: unknown

  constructor(message: string, code: string, providerMessage: string, rawResponse: unknown) {
    super(message)
    this.name = 'MetaGraphError'
    this.code = code
    this.providerMessage = providerMessage
    this.rawResponse = rawResponse
  }
}

export class WhatsAppConfigError extends MetaGraphError {
  constructor(missingField: string) {
    super(
      `Configuração do WhatsApp incompleta: ${missingField} não informado.`,
      META_GRAPH_ERROR_CODES.CONFIG_MISSING,
      missingField,
      null,
    )
    this.name = 'WhatsAppConfigError'
  }
}

export class WhatsAppConnectionError extends MetaGraphError {
  constructor(cause: string) {
    super(`Falha de rede ao comunicar com o WhatsApp: ${cause}`, META_GRAPH_ERROR_CODES.NETWORK, cause, null)
    this.name = 'WhatsAppConnectionError'
  }
}

export class WhatsAppRejectionError extends MetaGraphError {
  constructor(code: string, providerMessage: string, rawResponse: unknown) {
    super(`WhatsApp recusou a requisição: ${providerMessage}`, code, providerMessage, rawResponse)
    this.name = 'WhatsAppRejectionError'
  }
}

export class WhatsAppAudioTranscodeError extends MetaGraphError {
  constructor(reason: string) {
    super(
      `Não foi possível converter o áudio para ogg/opus antes do envio: ${reason}`,
      META_GRAPH_ERROR_CODES.AUDIO_TRANSCODE_FAILED,
      reason,
      null,
    )
    this.name = 'WhatsAppAudioTranscodeError'
  }
}

export class WhatsAppTimeoutError extends MetaGraphError {
  constructor(operation: string) {
    super(
      `Timeout ao comunicar com o WhatsApp (${operation}) — tente novamente.`,
      META_GRAPH_ERROR_CODES.TIMEOUT,
      'timeout',
      null,
    )
    this.name = 'WhatsAppTimeoutError'
  }
}

export class WhatsAppWindowExpiredError extends MetaGraphError {
  constructor(rawResponse: unknown) {
    super(
      'O cliente está fora da janela de 24h do WhatsApp. Envie uma mensagem de template (HSM) pré-aprovada para reabrir a conversa.',
      META_GRAPH_ERROR_CODES.WINDOW_EXPIRED,
      'window expired',
      rawResponse,
    )
    this.name = 'WhatsAppWindowExpiredError'
  }
}

export class WhatsAppTemplateDuplicateError extends MetaGraphError {
  constructor(rawResponse: unknown) {
    super(
      'Já existe um template com este nome no WhatsApp.',
      META_GRAPH_ERROR_CODES.TEMPLATE_DUPLICATE,
      'duplicate template name',
      rawResponse,
    )
    this.name = 'WhatsAppTemplateDuplicateError'
  }
}

export class WhatsAppUnexpectedResponseError extends MetaGraphError {
  constructor(validationMessage: string, rawResponse: unknown) {
    super(
      `Resposta inesperada da API do WhatsApp: ${validationMessage}`,
      META_GRAPH_ERROR_CODES.UNEXPECTED_RESPONSE,
      validationMessage,
      rawResponse,
    )
    this.name = 'WhatsAppUnexpectedResponseError'
  }
}

/**
 * Falhas em que repetir a mesma requisição pode dar outro resultado: ela não chegou a ser julgada
 * pela Meta — caiu antes, na rede ou no relógio.
 */
const RETRIABLE_CODES: readonly string[] = [META_GRAPH_ERROR_CODES.NETWORK, META_GRAPH_ERROR_CODES.TIMEOUT]

/**
 * A Meta olhou a requisição e recusou: token sem escopo, conta barrada de mandar mensagem para o
 * país, payload inválido. Repetir idêntica recebe a mesma recusa.
 *
 * Existe para separar o que vale retentar do que não vale **dentro do webhook**. Erro que sobe do
 * processamento de um webhook vira resposta não-2xx, e a Meta reentrega o evento; numa recusa
 * determinística essa reentrega falha igual, para sempre — e webhook que falha com frequência a
 * Meta desativa. Aí o canal inteiro cai, por uma causa que retentativa nenhuma ia corrigir.
 */
export function isDeterministicMetaRejection(error: unknown): error is MetaGraphError {
  return error instanceof MetaGraphError && !RETRIABLE_CODES.includes(error.code)
}
