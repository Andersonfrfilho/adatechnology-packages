/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { KeycloakJwtConfigurationError } from './keycloak-jwt.error'
import {
  KEYCLOAK_JWT_ALGORITHMS,
  type KeycloakJwtAlgorithm,
  type KeycloakJwtVerifierConfig,
} from './keycloak-jwt.types'

export type ValidatedKeycloakJwtVerifierConfig = {
  readonly issuer: string
  readonly audience: string[]
  readonly jwksUri: URL
  readonly algorithms: KeycloakJwtAlgorithm[]
  readonly requiredClaims: string[]
  readonly clockToleranceSeconds: number
}

const SUPPORTED_ALGORITHMS = new Set<string>(KEYCLOAK_JWT_ALGORITHMS)
const REQUIRED_STANDARD_CLAIMS = ['iss', 'aud', 'exp', 'sub'] as const

export function validateKeycloakJwtVerifierConfig(
  config: KeycloakJwtVerifierConfig,
): ValidatedKeycloakJwtVerifierConfig {
  if (typeof config !== 'object' || config === null) {
    throw new KeycloakJwtConfigurationError()
  }

  parseTrustedUrl(config.issuer)
  const jwksUri = parseTrustedUrl(config.jwksUri)
  const audience = normalizeAudience(config.audience)
  const algorithms = normalizeAlgorithms(config.algorithms)
  const requiredClaims = normalizeRequiredClaims(config.requiredClaims)
  const clockToleranceSeconds = normalizeClockTolerance(config.clockToleranceSeconds)

  return {
    issuer: config.issuer,
    audience,
    jwksUri,
    algorithms,
    requiredClaims,
    clockToleranceSeconds,
  }
}

function parseTrustedUrl(value: unknown): URL {
  let url: URL

  try {
    if (typeof value !== 'string' && !(value instanceof URL)) {
      throw new KeycloakJwtConfigurationError()
    }

    url = new URL(value)
  } catch {
    throw new KeycloakJwtConfigurationError()
  }

  if (
    url.username !== '' ||
    url.password !== '' ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopbackHostname(url.hostname)))
  ) {
    throw new KeycloakJwtConfigurationError()
  }

  return url
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function normalizeAudience(audience: unknown): string[] {
  const values = typeof audience === 'string' ? [audience] : Array.isArray(audience) ? audience : null

  if (
    values === null ||
    values.length === 0 ||
    values.some((value) => typeof value !== 'string' || value.trim() === '')
  ) {
    throw new KeycloakJwtConfigurationError()
  }

  return values
}

function normalizeAlgorithms(algorithms: unknown): KeycloakJwtAlgorithm[] {
  if (
    !Array.isArray(algorithms) ||
    algorithms.length === 0 ||
    algorithms.some((algorithm) => !SUPPORTED_ALGORITHMS.has(algorithm))
  ) {
    throw new KeycloakJwtConfigurationError()
  }

  return [...new Set(algorithms)]
}

function normalizeRequiredClaims(requiredClaims: unknown): string[] {
  const additionalClaims = requiredClaims === undefined ? [] : requiredClaims

  if (
    !Array.isArray(additionalClaims) ||
    additionalClaims.some((claim) => typeof claim !== 'string' || claim.trim() === '')
  ) {
    throw new KeycloakJwtConfigurationError()
  }

  return [...new Set([...REQUIRED_STANDARD_CLAIMS, ...additionalClaims])]
}

function normalizeClockTolerance(value: unknown): number {
  const tolerance = value ?? 0

  if (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || tolerance < 0 || tolerance > 300) {
    throw new KeycloakJwtConfigurationError()
  }

  return tolerance
}
