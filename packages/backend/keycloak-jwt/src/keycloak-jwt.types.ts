/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export const KEYCLOAK_JWT_ERROR_CODES = [
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'TOKEN_NOT_ACTIVE',
  'TOKEN_CLAIM_MISSING',
  'TOKEN_ALGORITHM_REJECTED',
  'TOKEN_KEY_REJECTED',
  'JWKS_UNAVAILABLE',
] as const

export type KeycloakJwtErrorCode = (typeof KEYCLOAK_JWT_ERROR_CODES)[number]

export const KEYCLOAK_JWT_ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
] as const

export type KeycloakJwtAlgorithm = (typeof KEYCLOAK_JWT_ALGORITHMS)[number]

export type KeycloakJwtRemoteJwksConfig = {
  readonly timeoutMilliseconds?: number
  readonly cooldownMilliseconds?: number
  readonly cacheMaxAgeMilliseconds?: number
  readonly responseSizeLimitBytes?: number
}

export type KeycloakJwtVerifierConfig = {
  readonly issuer: string
  readonly audience: string | readonly string[]
  readonly jwksUri: string | URL
  readonly algorithms: readonly KeycloakJwtAlgorithm[]
  readonly requiredClaims?: readonly string[]
  readonly clockToleranceSeconds?: number
  readonly jwks?: KeycloakJwtRemoteJwksConfig
}

export type VerifiedAccessToken = {
  readonly subject: string
  readonly issuer: string
  readonly audience: string | readonly string[]
  readonly expiresAt: number
  readonly claims: Readonly<Record<string, unknown>>
}

export type KeycloakJwtRemoteJwksStatus = {
  readonly hasUsableCachedKey: boolean
  readonly fresh: boolean
  readonly reloading: boolean
  readonly coolingDown: boolean
}

export type KeycloakJwtVerifier = {
  readonly verify: (token: string) => Promise<VerifiedAccessToken>
  readonly getJwksStatus: () => KeycloakJwtRemoteJwksStatus
}
