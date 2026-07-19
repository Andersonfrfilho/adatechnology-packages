/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  createKeycloakJwtVerifier,
  KeycloakJwtConfigurationError,
  KeycloakJwtVerificationError,
  type KeycloakJwtErrorCode,
  type KeycloakJwtVerifier,
} from '../src'

const ISSUER = 'https://identity.test/realms/transportada'
const AUDIENCE = 'transportada-api'
const KEY_ID = 'contract-key'
const NOW_SECONDS = Math.floor(Date.now() / 1_000)

type JwtHeader = {
  readonly alg: string
  readonly kid?: string
  readonly typ: 'JWT'
}

type JwtPayload = {
  readonly [claim: string]: unknown
  readonly iss?: unknown
  readonly aud?: unknown
  readonly sub?: unknown
  readonly exp?: unknown
  readonly nbf?: unknown
  readonly iat?: unknown
  readonly company_id?: unknown
}

let privateKey: CryptoKey
let jwksServer: ReturnType<typeof Bun.serve>
let verifier: KeycloakJwtVerifier

beforeAll(async () => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  privateKey = keyPair.privateKey

  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const jwks = {
    keys: [{ ...publicJwk, alg: 'RS256', kid: KEY_ID, use: 'sig' }],
  }

  jwksServer = Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname !== '/jwks') {
        return new Response(null, { status: 404 })
      }

      return Response.json(jwks)
    },
  })

  verifier = createKeycloakJwtVerifier({
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksUri: new URL('/jwks', jwksServer.url),
    algorithms: ['RS256'],
    requiredClaims: ['company_id'],
    clockToleranceSeconds: 0,
  })
})

afterAll(() => {
  jwksServer.stop(true)
})

describe('Keycloak access-token verification contract', () => {
  test('accepts a signed token with all required claims', async () => {
    const token = await signToken()

    await expect(verifier.verify(token)).resolves.toMatchObject({
      subject: 'user-123',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresAt: NOW_SECONDS + 300,
      claims: {
        company_id: '018f47c2-a98d-7d10-85db-b6bfb1598a42',
      },
    })
  })

  test('rejects a token from a different issuer', async () => {
    const token = await signToken({ iss: 'https://identity.test/realms/other' })

    await expectVerificationError(token, 'TOKEN_INVALID')
  })

  test('rejects a token without issuer', async () => {
    const token = await signToken({ iss: undefined })

    await expectVerificationError(token, 'TOKEN_CLAIM_MISSING')
  })

  test('rejects a token for a different audience', async () => {
    const token = await signToken({ aud: 'other-api' })

    await expectVerificationError(token, 'TOKEN_INVALID')
  })

  test('accepts an audience array containing the configured audience', async () => {
    const token = await signToken({ aud: ['account', AUDIENCE] })

    await expect(verifier.verify(token)).resolves.toMatchObject({
      subject: 'user-123',
      audience: ['account', AUDIENCE],
    })
  })

  test('rejects azp when the required aud claim is absent', async () => {
    const token = await signToken({ aud: undefined, azp: AUDIENCE })

    await expectVerificationError(token, 'TOKEN_CLAIM_MISSING')
  })

  test('rejects a token without audience', async () => {
    const token = await signToken({ aud: undefined })

    await expectVerificationError(token, 'TOKEN_CLAIM_MISSING')
  })

  test('rejects an expired token', async () => {
    const token = await signToken({ exp: NOW_SECONDS - 1 })

    await expectVerificationError(token, 'TOKEN_EXPIRED')
  })

  test('rejects a token without expiration', async () => {
    const token = await signToken({ exp: undefined })

    await expectVerificationError(token, 'TOKEN_CLAIM_MISSING')
  })

  test('rejects a token before nbf', async () => {
    const token = await signToken({ nbf: NOW_SECONDS + 60 })

    await expectVerificationError(token, 'TOKEN_NOT_ACTIVE')
  })

  test('applies the configured clock tolerance to exp and nbf', async () => {
    const tolerantVerifier = createKeycloakJwtVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUri: new URL('/jwks', jwksServer.url),
      algorithms: ['RS256'],
      requiredClaims: ['company_id'],
      clockToleranceSeconds: 5,
    })

    await expect(tolerantVerifier.verify(await signToken({ exp: NOW_SECONDS - 2 }))).resolves.toMatchObject({
      subject: 'user-123',
    })
    await expect(tolerantVerifier.verify(await signToken({ nbf: NOW_SECONDS + 2 }))).resolves.toMatchObject({
      subject: 'user-123',
    })
    await expectVerificationErrorWith(tolerantVerifier, await signToken({ exp: NOW_SECONDS - 10 }), 'TOKEN_EXPIRED')
    await expectVerificationErrorWith(tolerantVerifier, await signToken({ nbf: NOW_SECONDS + 10 }), 'TOKEN_NOT_ACTIVE')
  })

  test('accepts a token without optional nbf', async () => {
    const token = await signToken({ nbf: undefined })

    await expect(verifier.verify(token)).resolves.toMatchObject({
      subject: 'user-123',
    })
  })

  test('rejects a token without subject', async () => {
    const token = await signToken({ sub: undefined })

    await expectVerificationError(token, 'TOKEN_CLAIM_MISSING')
  })

  test('rejects an empty or non-string subject', async () => {
    await expectVerificationError(await signToken({ sub: '' }), 'TOKEN_CLAIM_MISSING')
    await expectVerificationError(await signToken({ sub: 123 }), 'TOKEN_CLAIM_MISSING')
  })

  test('rejects a token without a configured required claim', async () => {
    const token = await signToken({ company_id: undefined })

    await expectVerificationError(token, 'TOKEN_CLAIM_MISSING')
  })

  test('rejects an algorithm outside the configured allowlist', async () => {
    const token = await signToken({}, { alg: 'HS256' })

    await expectVerificationError(token, 'TOKEN_ALGORITHM_REJECTED')
  })

  test('rejects alg none', async () => {
    const token = await signToken({}, { alg: 'none' })

    await expectVerificationError(token, 'TOKEN_ALGORITHM_REJECTED')
  })

  test('rejects a token without kid', async () => {
    const token = await signToken({}, { kid: undefined })

    await expectVerificationError(token, 'TOKEN_KEY_REJECTED')
  })

  test('rejects a token with an unknown kid', async () => {
    const token = await signToken({}, { kid: 'unknown-key' })

    await expectVerificationError(token, 'TOKEN_KEY_REJECTED')
  })

  test('rejects a token with a tampered signature', async () => {
    const token = await signToken()
    const [header, payload, encodedSignature] = token.split('.')
    const signature = Buffer.from(encodedSignature!, 'base64url')
    signature[0] = signature[0]! ^ 1
    const tamperedToken = `${header}.${payload}.${signature.toString('base64url')}`

    await expectVerificationError(tamperedToken, 'TOKEN_INVALID')
  })

  test('rejects a malformed token without exposing its contents', async () => {
    await expectVerificationError('not-a-jwt.sensitive-company-claim', 'TOKEN_INVALID')
  })

  test('rejects an empty or unsafe algorithm allowlist as configuration', () => {
    const validConfig = {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUri: new URL('/jwks', jwksServer.url),
    }

    expect(() => createKeycloakJwtVerifier({ ...validConfig, algorithms: [] })).toThrow(KeycloakJwtConfigurationError)
    expect(() =>
      createKeycloakJwtVerifier({
        ...validConfig,
        algorithms: ['none' as never],
      }),
    ).toThrow(KeycloakJwtConfigurationError)
  })

  test('rejects an insecure non-loopback JWKS URL', () => {
    expect(() =>
      createKeycloakJwtVerifier({
        issuer: ISSUER,
        audience: AUDIENCE,
        jwksUri: 'http://identity.test/jwks',
        algorithms: ['RS256'],
      }),
    ).toThrow(KeycloakJwtConfigurationError)
  })
})

async function signToken(
  payloadOverrides: Partial<JwtPayload> = {},
  headerOverrides: Partial<JwtHeader> = {},
): Promise<string> {
  const header: JwtHeader = {
    alg: 'RS256',
    kid: KEY_ID,
    typ: 'JWT',
    ...headerOverrides,
  }
  const payload: JwtPayload = {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: 'user-123',
    exp: NOW_SECONDS + 300,
    nbf: NOW_SECONDS - 30,
    iat: NOW_SECONDS - 30,
    company_id: '018f47c2-a98d-7d10-85db-b6bfb1598a42',
    ...payloadOverrides,
  }
  const encodedHeader = encodeJson(header)
  const encodedPayload = encodeJson(payload)
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(signingInput))

  return `${signingInput}.${Buffer.from(signature).toString('base64url')}`
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

async function expectVerificationError(token: string, code: KeycloakJwtErrorCode): Promise<void> {
  await expectVerificationErrorWith(verifier, token, code)
}

async function expectVerificationErrorWith(
  tokenVerifier: KeycloakJwtVerifier,
  token: string,
  code: KeycloakJwtErrorCode,
): Promise<void> {
  try {
    await tokenVerifier.verify(token)
    throw new Error('Expected access-token verification to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(KeycloakJwtVerificationError)
    expect(error).toMatchObject({
      code,
      message: 'Access token verification failed',
    })
    expect(String(error)).not.toContain(token)
    expect(error).not.toHaveProperty('cause')
  }
}
