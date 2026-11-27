/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

export const USER_ERROR_CODE = {
  INVALID_CREDENTIALS: 'USER_INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'USER_EMAIL_ALREADY_EXISTS',
  NOT_AUTHENTICATED: 'USER_NOT_AUTHENTICATED',
  RESET_TOKEN_INVALID: 'USER_RESET_TOKEN_INVALID',
  RESET_TOKEN_EXPIRED: 'USER_RESET_TOKEN_EXPIRED',
  RESET_TOKEN_ALREADY_USED: 'USER_RESET_TOKEN_ALREADY_USED',
  WEAK_PASSWORD: 'USER_WEAK_PASSWORD',
  PROVIDER_MISCONFIGURED: 'USER_PROVIDER_MISCONFIGURED',
  PROVIDER_DISABLED: 'USER_PROVIDER_DISABLED',
  CONFIG_MISSING: 'USER_CONFIG_MISSING',
  AVATAR_REJECTED: 'USER_AVATAR_REJECTED',
  PASSWORD_NOT_LOCAL: 'USER_PASSWORD_NOT_LOCAL',
  CURRENT_PASSWORD_INVALID: 'USER_CURRENT_PASSWORD_INVALID',
  PHONE_ALREADY_EXISTS: 'USER_PHONE_ALREADY_EXISTS',
  PHONE_INVALID: 'USER_PHONE_INVALID',
  CONFIRMATION_TOKEN_INVALID: 'USER_CONFIRMATION_TOKEN_INVALID',
  VERIFICATION_CODE_INVALID: 'USER_VERIFICATION_CODE_INVALID',
  VERIFICATION_RATE_LIMITED: 'USER_VERIFICATION_RATE_LIMITED',
} as const

export type UserErrorCode = (typeof USER_ERROR_CODE)[keyof typeof USER_ERROR_CODE]

export class UserError extends Error {
  readonly statusCode: number
  readonly code: UserErrorCode
  readonly details?: unknown

  constructor(params: { message: string; statusCode: number; code: UserErrorCode; details?: unknown }) {
    super(params.message)
    this.name = 'UserError'
    this.statusCode = params.statusCode
    this.code = params.code
    this.details = params.details
  }
}

export class InvalidCredentialsError extends UserError {
  constructor() {
    super({
      message: 'Invalid credentials',
      statusCode: 401,
      code: USER_ERROR_CODE.INVALID_CREDENTIALS,
    })
    this.name = 'InvalidCredentialsError'
  }
}

export class UserNotFoundError extends UserError {
  constructor() {
    super({
      message: 'User not found',
      statusCode: 404,
      code: USER_ERROR_CODE.USER_NOT_FOUND,
    })
    this.name = 'UserNotFoundError'
  }
}

export class EmailAlreadyExistsError extends UserError {
  constructor() {
    super({
      message: 'Email already exists',
      statusCode: 409,
      code: USER_ERROR_CODE.EMAIL_ALREADY_EXISTS,
      details: { field: 'email' },
    })
    this.name = 'EmailAlreadyExistsError'
  }
}

export class NotAuthenticatedError extends UserError {
  constructor() {
    super({
      message: 'Not authenticated',
      statusCode: 401,
      code: USER_ERROR_CODE.NOT_AUTHENTICATED,
    })
    this.name = 'NotAuthenticatedError'
  }
}

export class ResetTokenInvalidError extends UserError {
  constructor() {
    super({
      message: 'Invalid reset token',
      statusCode: 400,
      code: USER_ERROR_CODE.RESET_TOKEN_INVALID,
    })
    this.name = 'ResetTokenInvalidError'
  }
}

export class ResetTokenExpiredError extends UserError {
  constructor() {
    super({
      message: 'Reset token expired',
      statusCode: 400,
      code: USER_ERROR_CODE.RESET_TOKEN_EXPIRED,
    })
    this.name = 'ResetTokenExpiredError'
  }
}

export class ResetTokenAlreadyUsedError extends UserError {
  constructor() {
    super({
      message: 'Reset token already used',
      statusCode: 400,
      code: USER_ERROR_CODE.RESET_TOKEN_ALREADY_USED,
    })
    this.name = 'ResetTokenAlreadyUsedError'
  }
}

export class WeakPasswordError extends UserError {
  constructor() {
    super({
      message: 'Password does not meet security requirements',
      statusCode: 400,
      code: USER_ERROR_CODE.WEAK_PASSWORD,
    })
    this.name = 'WeakPasswordError'
  }
}

/** A pessoa entra por provedor externo (Keycloak...): a senha não é do módulo para trocar. */
export class PasswordNotLocalError extends UserError {
  constructor() {
    super({
      message: 'User signs in through an external provider',
      statusCode: 409,
      code: USER_ERROR_CODE.PASSWORD_NOT_LOCAL,
    })
    this.name = 'PasswordNotLocalError'
  }
}

export class ProviderMisconfiguredError extends UserError {
  constructor(details?: unknown) {
    super({
      message: 'Authentication provider is misconfigured',
      statusCode: 500,
      code: USER_ERROR_CODE.PROVIDER_MISCONFIGURED,
      details,
    })
    this.name = 'ProviderMisconfiguredError'
  }
}

export class ProviderDisabledError extends UserError {
  constructor() {
    super({
      message: 'Authentication provider is not available',
      statusCode: 503,
      code: USER_ERROR_CODE.PROVIDER_DISABLED,
    })
    this.name = 'ProviderDisabledError'
  }
}

export class ConfigMissingError extends UserError {
  constructor(field: string) {
    super({
      message: `Missing required configuration: ${field}`,
      statusCode: 500,
      code: USER_ERROR_CODE.CONFIG_MISSING,
      details: { field },
    })
    this.name = 'ConfigMissingError'
  }
}

/**
 * O `details.reason` e o motivo estavel (`AvatarRejection`), nao a frase.
 *
 * "Grande demais" e "tipo nao suportado" pedem correcoes diferentes, e quem monta a tela precisa
 * distinguir os dois sem casar string traduzida.
 */
export class AvatarRejectedError extends UserError {
  constructor(reason: string) {
    super({
      message: 'Avatar rejected',
      statusCode: 400,
      code: USER_ERROR_CODE.AVATAR_REJECTED,
      details: { reason },
    })
    this.name = 'AvatarRejectedError'
  }
}

/** A senha atual conferida antes de uma troca sensível não bate (ou a conta está bloqueada). 403, não 401: a sessão segue válida. */
export class CurrentPasswordInvalidError extends UserError {
  constructor() {
    super({
      message: 'Current password does not match',
      statusCode: 403,
      code: USER_ERROR_CODE.CURRENT_PASSWORD_INVALID,
      details: { field: 'currentPassword' },
    })
    this.name = 'CurrentPasswordInvalidError'
  }
}

export class PhoneAlreadyExistsError extends UserError {
  constructor() {
    super({
      message: 'Phone already exists',
      statusCode: 409,
      code: USER_ERROR_CODE.PHONE_ALREADY_EXISTS,
      details: { field: 'phone' },
    })
    this.name = 'PhoneAlreadyExistsError'
  }
}

export class PhoneInvalidError extends UserError {
  constructor() {
    super({
      message: 'Invalid phone number',
      statusCode: 400,
      code: USER_ERROR_CODE.PHONE_INVALID,
      details: { field: 'phone' },
    })
    this.name = 'PhoneInvalidError'
  }
}

/** Link de confirmação desconhecido, vencido ou já usado: a mesma resposta para os três. */
export class ConfirmationTokenInvalidError extends UserError {
  constructor() {
    super({
      message: 'Confirmation link is invalid or expired',
      statusCode: 400,
      code: USER_ERROR_CODE.CONFIRMATION_TOKEN_INVALID,
    })
    this.name = 'ConfirmationTokenInvalidError'
  }
}

export class VerificationCodeInvalidError extends UserError {
  constructor() {
    super({
      message: 'Verification code is invalid or expired',
      statusCode: 400,
      code: USER_ERROR_CODE.VERIFICATION_CODE_INVALID,
    })
    this.name = 'VerificationCodeInvalidError'
  }
}

/** Reenvio antes do intervalo mínimo, ou tentativas do código esgotadas. `details.retryAfterSeconds` quando houver. */
export class VerificationRateLimitedError extends UserError {
  constructor(retryAfterSeconds?: number) {
    super({
      message: 'Too many verification attempts',
      statusCode: 429,
      code: USER_ERROR_CODE.VERIFICATION_RATE_LIMITED,
      ...(retryAfterSeconds === undefined ? {} : { details: { retryAfterSeconds } }),
    })
    this.name = 'VerificationRateLimitedError'
  }
}
