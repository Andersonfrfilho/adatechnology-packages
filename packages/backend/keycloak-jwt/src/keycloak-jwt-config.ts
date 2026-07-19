/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { KeycloakJwtConfigurationError } from './keycloak-jwt.error'
import {
  KEYCLOAK_JWT_ALGORITHMS,
  type KeycloakJwtAlgorithm,
  type KeycloakJwtRemoteJwksConfig,
  type KeycloakJwtVerifierConfig,
} from './keycloak-jwt.types'

export type ValidatedRemoteJwksConfig = {
  readonly timeoutMilliseconds: number
  readonly cooldownMilliseconds: number
  readonly cacheMaxAgeMilliseconds: number
  readonly responseSizeLimitBytes: number
}

export type ValidatedKeycloakJwtVerifierConfig = {
  readonly issuer: string
  readonly audience: string[]
  readonly jwksUri: URL
  readonly algorithms: KeycloakJwtAlgorithm[]
  readonly requiredClaims: string[]
  readonly clockToleranceSeconds: number
  readonly jwks: ValidatedRemoteJwksConfig
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
  const jwks = normalizeRemoteJwksConfig(config.jwks)

  return {
    issuer: config.issuer,
    audience,
    jwksUri,
    algorithms,
    requiredClaims,
    clockToleranceSeconds,
    jwks,
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

function normalizeRemoteJwksConfig(value: unknown): ValidatedRemoteJwksConfig {
  if (value !== undefined && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    throw new KeycloakJwtConfigurationError()
  }

  const config = (value ?? {}) as KeycloakJwtRemoteJwksConfig
  const timeoutMilliseconds = normalizeIntegerInRange(config.timeoutMilliseconds, 5_000, 1, 30_000)
  const cooldownMilliseconds = normalizeIntegerInRange(config.cooldownMilliseconds, 30_000, 1_000, 300_000)
  const cacheMaxAgeMilliseconds = normalizeIntegerInRange(config.cacheMaxAgeMilliseconds, 600_000, 1_000, 86_400_000)
  const responseSizeLimitBytes = normalizeIntegerInRange(config.responseSizeLimitBytes, 1_048_576, 256, 10_485_760)

  if (cacheMaxAgeMilliseconds < cooldownMilliseconds) {
    throw new KeycloakJwtConfigurationError()
  }

  return {
    timeoutMilliseconds,
    cooldownMilliseconds,
    cacheMaxAgeMilliseconds,
    responseSizeLimitBytes,
  }
}

function normalizeIntegerInRange(value: unknown, defaultValue: number, minimum: number, maximum: number): number {
  const normalized = value ?? defaultValue

  if (typeof normalized !== 'number' || !Number.isInteger(normalized) || normalized < minimum || normalized > maximum) {
    throw new KeycloakJwtConfigurationError()
  }

  return normalized
}
