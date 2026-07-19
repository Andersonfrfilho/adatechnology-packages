/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import {
  createRemoteJWKSet,
  customFetch,
  decodeProtectedHeader,
  errors,
  jwtVerify,
  type FetchImplementation,
} from 'jose'
import { validateKeycloakJwtVerifierConfig } from './keycloak-jwt-config'
import { KeycloakJwtResponseLimitError, KeycloakJwtVerificationError } from './keycloak-jwt.error'
import type {
  KeycloakJwtErrorCode,
  KeycloakJwtVerifier,
  KeycloakJwtVerifierConfig,
  VerifiedAccessToken,
} from './keycloak-jwt.types'

export function createKeycloakJwtVerifier(config: KeycloakJwtVerifierConfig): KeycloakJwtVerifier {
  const validatedConfig = validateKeycloakJwtVerifierConfig(config)
  const remoteJwks = createRemoteJWKSet(validatedConfig.jwksUri, {
    timeoutDuration: validatedConfig.jwks.timeoutMilliseconds,
    cooldownDuration: validatedConfig.jwks.cooldownMilliseconds,
    cacheMaxAge: validatedConfig.jwks.cacheMaxAgeMilliseconds,
    [customFetch]: createLimitedFetch(validatedConfig.jwks.responseSizeLimitBytes),
  })
  const allowedAlgorithms = new Set<string>(validatedConfig.algorithms)
  let hasUsableCachedKey = false

  return {
    getJwksStatus() {
      return {
        hasUsableCachedKey,
        fresh: remoteJwks.fresh,
        reloading: remoteJwks.reloading,
        coolingDown: remoteJwks.coolingDown,
      }
    },
    async verify(token) {
      try {
        validateProtectedHeader(token, allowedAlgorithms)

        const { payload } = await jwtVerify(token, remoteJwks, {
          algorithms: validatedConfig.algorithms,
          audience: validatedConfig.audience,
          issuer: validatedConfig.issuer,
          requiredClaims: validatedConfig.requiredClaims,
          clockTolerance: validatedConfig.clockToleranceSeconds,
        })

        const verifiedToken = normalizeVerifiedToken(payload)
        hasUsableCachedKey = true
        return verifiedToken
      } catch (error) {
        if (error instanceof KeycloakJwtVerificationError) {
          throw error
        }

        throw new KeycloakJwtVerificationError(classifyJoseError(error))
      }
    },
  }
}

function validateProtectedHeader(token: string, allowedAlgorithms: ReadonlySet<string>): void {
  let protectedHeader: ReturnType<typeof decodeProtectedHeader>

  try {
    protectedHeader = decodeProtectedHeader(token)
  } catch {
    throw new KeycloakJwtVerificationError('TOKEN_INVALID')
  }

  if (typeof protectedHeader.alg !== 'string' || !allowedAlgorithms.has(protectedHeader.alg)) {
    throw new KeycloakJwtVerificationError('TOKEN_ALGORITHM_REJECTED')
  }

  if (typeof protectedHeader.kid !== 'string' || protectedHeader.kid.trim() === '') {
    throw new KeycloakJwtVerificationError('TOKEN_KEY_REJECTED')
  }
}

function normalizeVerifiedToken(claims: Readonly<Record<string, unknown>>): VerifiedAccessToken {
  if (
    typeof claims.sub !== 'string' ||
    claims.sub.trim() === '' ||
    typeof claims.iss !== 'string' ||
    (typeof claims.aud !== 'string' && !isStringArray(claims.aud)) ||
    typeof claims.exp !== 'number'
  ) {
    throw new KeycloakJwtVerificationError('TOKEN_CLAIM_MISSING')
  }

  return {
    subject: claims.sub,
    issuer: claims.iss,
    audience: claims.aud,
    expiresAt: claims.exp,
    claims: Object.freeze({ ...claims }),
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string')
}

function classifyJoseError(error: unknown): KeycloakJwtErrorCode {
  if (error instanceof errors.JWTExpired) {
    return 'TOKEN_EXPIRED'
  }

  if (error instanceof errors.JWTClaimValidationFailed) {
    if (error.reason === 'missing') {
      return 'TOKEN_CLAIM_MISSING'
    }

    if (error.claim === 'nbf') {
      return 'TOKEN_NOT_ACTIVE'
    }

    return 'TOKEN_INVALID'
  }

  if (error instanceof errors.JOSEAlgNotAllowed) {
    return 'TOKEN_ALGORITHM_REJECTED'
  }

  if (error instanceof errors.JWKSNoMatchingKey) {
    return 'TOKEN_KEY_REJECTED'
  }

  if (
    error instanceof errors.JWKSTimeout ||
    error instanceof errors.JWKSInvalid ||
    error instanceof KeycloakJwtResponseLimitError ||
    (error instanceof errors.JOSEError && error.code === 'ERR_JOSE_GENERIC') ||
    error instanceof TypeError
  ) {
    return 'JWKS_UNAVAILABLE'
  }

  return 'TOKEN_INVALID'
}

function createLimitedFetch(responseSizeLimitBytes: number): FetchImplementation {
  return async (url, options) => {
    const response = await fetch(url, options)
    const declaredLength = Number(response.headers.get('content-length') ?? Number.NaN)

    if (Number.isFinite(declaredLength) && declaredLength > responseSizeLimitBytes) {
      await response.body?.cancel()
      throw new KeycloakJwtResponseLimitError()
    }

    if (response.body === null) {
      return response
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let receivedBytes = 0

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      receivedBytes += value.byteLength
      if (receivedBytes > responseSizeLimitBytes) {
        await reader.cancel()
        throw new KeycloakJwtResponseLimitError()
      }

      chunks.push(value)
    }

    const body = new Uint8Array(receivedBytes)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }
}
