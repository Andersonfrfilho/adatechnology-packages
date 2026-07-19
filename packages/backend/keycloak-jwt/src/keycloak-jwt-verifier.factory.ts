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
  KeycloakJwtAlgorithm,
  KeycloakJwtErrorCode,
  KeycloakJwtJwksProbeResult,
  KeycloakJwtVerifier,
  KeycloakJwtVerifierConfig,
  VerifiedAccessToken,
} from './keycloak-jwt.types'

type RemoteJwks = ReturnType<typeof createRemoteJWKSet>

type JwksReadinessState = {
  cacheGeneration: number
  validatedCacheGeneration: number | undefined
}

type CreateJwksProbeOptions = {
  readonly algorithms: readonly KeycloakJwtAlgorithm[]
  readonly cooldownMilliseconds: number
  readonly readinessState: JwksReadinessState
  readonly remoteJwks: RemoteJwks
}

type KeyResolutionCandidate = {
  readonly algorithm: KeycloakJwtAlgorithm
  readonly keyId: string
}

type CreateLimitedFetchOptions = {
  readonly onFetch: () => void
  readonly responseSizeLimitBytes: number
}

const JWKS_READY_RESULT: KeycloakJwtJwksProbeResult = Object.freeze({ ready: true })
const JWKS_NOT_READY_RESULT: KeycloakJwtJwksProbeResult = Object.freeze({ ready: false })

export function createKeycloakJwtVerifier(config: KeycloakJwtVerifierConfig): KeycloakJwtVerifier {
  const validatedConfig = validateKeycloakJwtVerifierConfig(config)
  const readinessState: JwksReadinessState = {
    cacheGeneration: 0,
    validatedCacheGeneration: undefined,
  }
  const remoteJwks = createRemoteJWKSet(validatedConfig.jwksUri, {
    timeoutDuration: validatedConfig.jwks.timeoutMilliseconds,
    cooldownDuration: validatedConfig.jwks.cooldownMilliseconds,
    cacheMaxAge: validatedConfig.jwks.cacheMaxAgeMilliseconds,
    [customFetch]: createLimitedFetch({
      onFetch: () => {
        readinessState.cacheGeneration += 1
      },
      responseSizeLimitBytes: validatedConfig.jwks.responseSizeLimitBytes,
    }),
  })
  const allowedAlgorithms = new Set<string>(validatedConfig.algorithms)
  const probeJwks = createJwksProbe({
    algorithms: validatedConfig.algorithms,
    cooldownMilliseconds: validatedConfig.jwks.cooldownMilliseconds,
    readinessState,
    remoteJwks,
  })

  return {
    getJwksStatus() {
      return {
        hasUsableCachedKey: hasCurrentValidatedKeySet(readinessState),
        fresh: remoteJwks.fresh,
        reloading: remoteJwks.reloading,
        coolingDown: remoteJwks.coolingDown,
      }
    },
    probeJwks,
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
        readinessState.validatedCacheGeneration = readinessState.cacheGeneration
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

function createJwksProbe(options: CreateJwksProbeOptions): () => Promise<KeycloakJwtJwksProbeResult> {
  let failedAtMilliseconds: number | undefined
  let pendingProbe: Promise<KeycloakJwtJwksProbeResult> | undefined

  async function executeProbe(): Promise<KeycloakJwtJwksProbeResult> {
    try {
      await options.remoteJwks.reload()
      const isReady = await hasResolvablePublicKey(options.remoteJwks, options.algorithms)
      options.readinessState.validatedCacheGeneration = isReady ? options.readinessState.cacheGeneration : undefined
      failedAtMilliseconds = isReady ? undefined : Date.now()
      return isReady ? JWKS_READY_RESULT : JWKS_NOT_READY_RESULT
    } catch {
      options.readinessState.validatedCacheGeneration = undefined
      failedAtMilliseconds = Date.now()
      return JWKS_NOT_READY_RESULT
    }
  }

  return async () => {
    if (pendingProbe !== undefined) {
      return pendingProbe
    }

    if (hasCurrentValidatedKeySet(options.readinessState) && options.remoteJwks.fresh) {
      return JWKS_READY_RESULT
    }

    if (isFailedProbeCoolingDown(failedAtMilliseconds, options.cooldownMilliseconds)) {
      return JWKS_NOT_READY_RESULT
    }

    pendingProbe = executeProbe()
    try {
      return await pendingProbe
    } finally {
      pendingProbe = undefined
    }
  }
}

function hasCurrentValidatedKeySet(readinessState: JwksReadinessState): boolean {
  return (
    readinessState.validatedCacheGeneration !== undefined &&
    readinessState.validatedCacheGeneration === readinessState.cacheGeneration
  )
}

function isFailedProbeCoolingDown(failedAtMilliseconds: number | undefined, cooldownMilliseconds: number): boolean {
  return failedAtMilliseconds !== undefined && Date.now() < failedAtMilliseconds + cooldownMilliseconds
}

async function hasResolvablePublicKey(
  remoteJwks: RemoteJwks,
  algorithms: readonly KeycloakJwtAlgorithm[],
): Promise<boolean> {
  const candidates = createKeyResolutionCandidates(remoteJwks, algorithms)
  for (const candidate of candidates) {
    try {
      const key = await remoteJwks({ alg: candidate.algorithm, kid: candidate.keyId })
      if (key.type === 'public') {
        return true
      }
    } catch {
      // Try the next bounded candidate without exposing resolver details.
    }
  }

  return false
}

function createKeyResolutionCandidates(
  remoteJwks: RemoteJwks,
  algorithms: readonly KeycloakJwtAlgorithm[],
): KeyResolutionCandidate[] {
  const keySet = remoteJwks.jwks()
  if (keySet === undefined) {
    return []
  }

  const candidates = keySet.keys.flatMap((key) => {
    if (typeof key.kid !== 'string' || key.kid.trim() === '') {
      return []
    }

    const keyId = key.kid
    return algorithms.map((algorithm) => ({ algorithm, keyId }))
  })

  return candidates
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

function createLimitedFetch(limitedFetchOptions: CreateLimitedFetchOptions): FetchImplementation {
  return async (url, requestOptions) => {
    limitedFetchOptions.onFetch()
    const response = await fetch(url, requestOptions)
    const declaredLength = Number(response.headers.get('content-length') ?? Number.NaN)

    if (Number.isFinite(declaredLength) && declaredLength > limitedFetchOptions.responseSizeLimitBytes) {
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
      if (receivedBytes > limitedFetchOptions.responseSizeLimitBytes) {
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
