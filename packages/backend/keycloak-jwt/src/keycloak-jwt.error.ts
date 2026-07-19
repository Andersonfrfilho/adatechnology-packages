/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { KeycloakJwtErrorCode } from './keycloak-jwt.types'

export class KeycloakJwtVerificationError extends Error {
  readonly code: KeycloakJwtErrorCode

  constructor(code: KeycloakJwtErrorCode) {
    super('Access token verification failed')
    this.name = 'KeycloakJwtVerificationError'
    this.code = code
  }
}

export class KeycloakJwtConfigurationError extends Error {
  constructor() {
    super('Invalid Keycloak JWT verifier configuration')
    this.name = 'KeycloakJwtConfigurationError'
  }
}
