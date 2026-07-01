export class WhatsAppError extends Error {
  readonly code: string
  readonly providerMessage: string
  readonly rawResponse: unknown

  constructor(message: string, code: string, providerMessage: string, rawResponse: unknown) {
    super(message)
    this.name = 'WhatsAppError'
    this.code = code
    this.providerMessage = providerMessage
    this.rawResponse = rawResponse
  }
}

export class WhatsAppConfigError extends WhatsAppError {
  constructor(missingField: string) {
    super(
      `Configuração do WhatsApp incompleta: ${missingField} não informado.`,
      'WHATSAPP_CONFIG_MISSING',
      missingField,
      null,
    )
    this.name = 'WhatsAppConfigError'
  }
}

export class WhatsAppConnectionError extends WhatsAppError {
  constructor(cause: string) {
    super(`Falha de rede ao comunicar com o WhatsApp: ${cause}`, 'WHATSAPP_NETWORK_ERROR', cause, null)
    this.name = 'WhatsAppConnectionError'
  }
}

export class WhatsAppRejectionError extends WhatsAppError {
  constructor(code: string, providerMessage: string, rawResponse: unknown) {
    super(`WhatsApp recusou a requisição: ${providerMessage}`, code, providerMessage, rawResponse)
    this.name = 'WhatsAppRejectionError'
  }
}

export class WhatsAppTimeoutError extends WhatsAppError {
  constructor(operation: string) {
    super(`Timeout ao comunicar com o WhatsApp (${operation}) — tente novamente.`, 'WHATSAPP_TIMEOUT', 'timeout', null)
    this.name = 'WhatsAppTimeoutError'
  }
}

export class WhatsAppWindowExpiredError extends WhatsAppError {
  constructor(rawResponse: unknown) {
    super(
      'O cliente está fora da janela de 24h do WhatsApp. Envie uma mensagem de template (HSM) pré-aprovada para reabrir a conversa.',
      'WHATSAPP_WINDOW_EXPIRED',
      'window expired',
      rawResponse,
    )
    this.name = 'WhatsAppWindowExpiredError'
  }
}

export class WhatsAppTemplateDuplicateError extends WhatsAppError {
  constructor(rawResponse: unknown) {
    super('Já existe um template com este nome no WhatsApp.', 'WHATSAPP_TEMPLATE_DUPLICATE', 'duplicate template name', rawResponse)
    this.name = 'WhatsAppTemplateDuplicateError'
  }
}
