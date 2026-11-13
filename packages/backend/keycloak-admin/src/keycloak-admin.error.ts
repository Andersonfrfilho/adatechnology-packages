import type { KeycloakAdminErrorCode } from './keycloak-admin.constant.js'

export type KeycloakAdminErrorContext = Readonly<Record<string, unknown>>

export type KeycloakAdminErrorParams = {
  readonly code: KeycloakAdminErrorCode
  readonly context?: KeycloakAdminErrorContext
  readonly message: string
  readonly status?: number
}

export type SerializedKeycloakAdminError = {
  readonly code: KeycloakAdminErrorCode
  readonly context: KeycloakAdminErrorContext
  readonly message: string
  readonly name: string
  readonly status: number | undefined
}

/**
 * Falha de qualquer operação do Admin API, com código estável para o consumidor decidir.
 * O contexto é montado por allowlist e passa pelo redator — segredo, token e senha nunca entram.
 */
export class KeycloakAdminError extends Error {
  readonly code: KeycloakAdminErrorCode
  readonly context: KeycloakAdminErrorContext
  readonly status: number | undefined

  constructor({ code, context = {}, message, status }: KeycloakAdminErrorParams) {
    super(message)
    this.name = 'KeycloakAdminError'
    this.code = code
    this.context = context
    this.status = status
    Object.setPrototypeOf(this, KeycloakAdminError.prototype)
  }

  toJSON(): SerializedKeycloakAdminError {
    return {
      code: this.code,
      context: this.context,
      message: this.message,
      name: this.name,
      status: this.status,
    }
  }
}

export function isKeycloakAdminError(value: unknown): value is KeycloakAdminError {
  return value instanceof KeycloakAdminError
}
