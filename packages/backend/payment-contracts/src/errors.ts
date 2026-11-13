/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const PAYMENT_ERROR_CODE = {
  PROVIDER_UNKNOWN: 'PAYMENT_PROVIDER_UNKNOWN',
  PROVIDER_NOT_CONFIGURED: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
  PROVIDER_CAPABILITY_MISSING: 'PAYMENT_PROVIDER_CAPABILITY_MISSING',
  WEBHOOK_UNAUTHORIZED: 'PAYMENT_WEBHOOK_UNAUTHORIZED',
  WEBHOOK_INVALID: 'PAYMENT_WEBHOOK_INVALID',
  PLAN_NOT_FOUND: 'PAYMENT_PLAN_NOT_FOUND',
  SUBSCRIPTION_NOT_FOUND: 'PAYMENT_SUBSCRIPTION_NOT_FOUND',
  PURCHASE_NOT_CLAIMABLE: 'PAYMENT_PURCHASE_NOT_CLAIMABLE',
  FEATURE_REQUIRED: 'PAYMENT_FEATURE_REQUIRED',
  CONFIG_INVALID: 'PAYMENT_CONFIG_INVALID',
} as const

export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODE)[keyof typeof PAYMENT_ERROR_CODE]

/**
 * Status HTTP por código, numa tabela só: o filtro do `module-http` reconhece o erro pela forma
 * (`statusCode`, `code`, `message`), e código novo sem entrada aqui não compila.
 */
const STATUS_BY_CODE: Readonly<Record<PaymentErrorCode, number>> = {
  [PAYMENT_ERROR_CODE.PROVIDER_UNKNOWN]: 404,
  [PAYMENT_ERROR_CODE.PROVIDER_NOT_CONFIGURED]: 503,
  [PAYMENT_ERROR_CODE.PROVIDER_CAPABILITY_MISSING]: 501,
  [PAYMENT_ERROR_CODE.WEBHOOK_UNAUTHORIZED]: 401,
  [PAYMENT_ERROR_CODE.WEBHOOK_INVALID]: 400,
  [PAYMENT_ERROR_CODE.PLAN_NOT_FOUND]: 404,
  [PAYMENT_ERROR_CODE.SUBSCRIPTION_NOT_FOUND]: 404,
  // Uma resposta só para "não existe" e "já é de outra pessoa": quem tenta código não aprende nada.
  [PAYMENT_ERROR_CODE.PURCHASE_NOT_CLAIMABLE]: 404,
  // 402: o recurso existe, o plano da pessoa é que não libera.
  [PAYMENT_ERROR_CODE.FEATURE_REQUIRED]: 402,
  // Composição errada do host: quem tem de ver é o log do boot.
  [PAYMENT_ERROR_CODE.CONFIG_INVALID]: 500,
}

export class PaymentError extends Error {
  readonly statusCode: number

  constructor(
    message: string,
    readonly code: PaymentErrorCode,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message)
    this.name = new.target.name
    this.statusCode = STATUS_BY_CODE[code]
  }
}

export class PaymentProviderUnknownError extends PaymentError {
  constructor(provider: string) {
    super('Provedor de pagamento desconhecido.', PAYMENT_ERROR_CODE.PROVIDER_UNKNOWN, { provider })
  }
}

export class PaymentProviderNotConfiguredError extends PaymentError {
  constructor(provider: string) {
    super('Provedor de pagamento sem credencial no servidor.', PAYMENT_ERROR_CODE.PROVIDER_NOT_CONFIGURED, { provider })
  }
}

export class PaymentProviderCapabilityMissingError extends PaymentError {
  constructor(provider: string, capability: string) {
    super(`O provedor ${provider} não oferece ${capability}.`, PAYMENT_ERROR_CODE.PROVIDER_CAPABILITY_MISSING, {
      provider,
      capability,
    })
  }
}

export class PaymentWebhookUnauthorizedError extends PaymentError {
  constructor(provider: string) {
    super('Webhook sem credencial válida.', PAYMENT_ERROR_CODE.WEBHOOK_UNAUTHORIZED, { provider })
  }
}

export class PaymentWebhookInvalidError extends PaymentError {
  constructor(provider: string, reason: string) {
    super(`Webhook inválido: ${reason}`, PAYMENT_ERROR_CODE.WEBHOOK_INVALID, { provider })
  }
}

export class PaymentPlanNotFoundError extends PaymentError {
  constructor(planCode: string) {
    super('Plano não encontrado.', PAYMENT_ERROR_CODE.PLAN_NOT_FOUND, { planCode })
  }
}

export class PaymentSubscriptionNotFoundError extends PaymentError {
  constructor() {
    super('Assinatura não encontrada.', PAYMENT_ERROR_CODE.SUBSCRIPTION_NOT_FOUND)
  }
}

export class PaymentPurchaseNotClaimableError extends PaymentError {
  constructor() {
    super('Não encontramos uma compra sem dono com esse código.', PAYMENT_ERROR_CODE.PURCHASE_NOT_CLAIMABLE)
  }
}

export class PaymentFeatureRequiredError extends PaymentError {
  constructor(feature: string) {
    super('Este recurso não faz parte do seu plano.', PAYMENT_ERROR_CODE.FEATURE_REQUIRED, { feature })
  }
}

export class PaymentConfigInvalidError extends PaymentError {
  constructor(reason: string) {
    super(`Configuração de pagamentos inválida: ${reason}`, PAYMENT_ERROR_CODE.CONFIG_INVALID)
  }
}
