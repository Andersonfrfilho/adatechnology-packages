export class FiscalError extends Error {
  readonly code: string
  readonly providerMessage: string
  readonly rawResponse: unknown

  constructor(message: string, code: string, providerMessage: string, rawResponse: unknown) {
    super(message)
    this.name = 'FiscalError'
    this.code = code
    this.providerMessage = providerMessage
    this.rawResponse = rawResponse
  }
}

export class FiscalConnectionError extends FiscalError {
  constructor(provider: string, cause: string) {
    super(`Não foi possível conectar ao provedor ${provider}: ${cause}`, 'FISCAL_CONNECTION_ERROR', cause, null)
    this.name = 'FiscalConnectionError'
  }
}

export class FiscalRejectionError extends FiscalError {
  constructor(sefazCode: string, sefazMessage: string, rawResponse: unknown) {
    super(`SEFAZ rejeitou a nota: [${sefazCode}] ${sefazMessage}`, sefazCode, sefazMessage, rawResponse)
    this.name = 'FiscalRejectionError'
  }
}

export class FiscalTimeoutError extends FiscalError {
  constructor(provider: string) {
    super(`Timeout ao comunicar com ${provider} — tente novamente`, 'FISCAL_TIMEOUT', 'timeout', null)
    this.name = 'FiscalTimeoutError'
  }
}

export class FiscalValidationError extends FiscalError {
  constructor(message: string, details: unknown) {
    super(message, 'FISCAL_VALIDATION_ERROR', message, details)
    this.name = 'FiscalValidationError'
  }
}
