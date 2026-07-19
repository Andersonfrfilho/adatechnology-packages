/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { KeycloakJwtVerifier, KeycloakJwtVerifierConfig } from './keycloak-jwt.types'

export function createKeycloakJwtVerifier(config: KeycloakJwtVerifierConfig): KeycloakJwtVerifier {
  void config

  return {
    async verify() {
      throw new Error('Not implemented')
    },
  }
}
