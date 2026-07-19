/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import {
  createKeycloakJwtVerifier,
  KeycloakJwtConfigurationError,
  KeycloakJwtVerificationError,
  type KeycloakJwtVerifier,
  type KeycloakJwtVerifierConfig,
} from '../src'

const ISSUER = 'https://identity.test/realms/transportada'
const AUDIENCE = 'transportada-api'

type SigningKey = {
  readonly id: string
  readonly privateKey: CryptoKey
  readonly publicJwk: JsonWebKey
}

let firstKey: SigningKey
let secondKey: SigningKey
let activeKeys: readonly SigningKey[]
let fetchCount = 0
let responseDelayMilliseconds = 0
let responseBodyDelayMilliseconds = 0
let responsePaddingBytes = 0
let jwksServer: ReturnType<typeof Bun.serve>

beforeAll(async () => {
  ;[firstKey, secondKey] = await Promise.all([createSigningKey('key-1'), createSigningKey('key-2')])

  jwksServer = Bun.serve({
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname !== '/jwks') {
        return new Response(null, { status: 404 })
      }

      fetchCount += 1

      if (responseDelayMilliseconds > 0) {
        await Bun.sleep(responseDelayMilliseconds)
      }

      const body = JSON.stringify({
        keys: activeKeys.map((key) => key.publicJwk),
        padding: 'x'.repeat(responsePaddingBytes),
      })

      return new Response(createChunkedBody(body), {
        headers: { 'content-type': 'application/json' },
      })
    },
  })
})

beforeEach(() => {
  activeKeys = [firstKey]
  fetchCount = 0
  responseDelayMilliseconds = 0
  responseBodyDelayMilliseconds = 0
  responsePaddingBytes = 0
})

afterAll(() => {
  jwksServer.stop(true)
})

describe('remote JWKS integration', () => {
  test('exposes readiness state without returning JWKS contents', async () => {
    responseDelayMilliseconds = 50
    const verifier = createVerifier()
    const token = await signToken(firstKey)

    expect(verifier.getJwksStatus()).toEqual({
      hasUsableCachedKey: false,
      fresh: false,
      reloading: false,
      coolingDown: false,
    })

    const verification = verifier.verify(token)
    await Bun.sleep(5)
    expect(verifier.getJwksStatus()).toMatchObject({
      hasUsableCachedKey: false,
      reloading: true,
    })

    await verification
    expect(verifier.getJwksStatus()).toMatchObject({
      hasUsableCachedKey: true,
      fresh: true,
      reloading: false,
    })
    expect(verifier.getJwksStatus()).not.toHaveProperty('jwks')
    expect(verifier.getJwksStatus()).not.toHaveProperty('url')
  })

  test('deduplicates the initial fetch for 10 concurrent verifications', async () => {
    const verifier = createVerifier()
    const token = await signToken(firstKey)

    const results = await Promise.all(Array.from({ length: 10 }, () => verifier.verify(token)))

    expect(results).toHaveLength(10)
    expect(results.every((result) => result.subject === 'user-123')).toBe(true)
    expect(fetchCount).toBe(1)
  })

  test('reuses a fresh JWKS cache for sequential verifications', async () => {
    const verifier = createVerifier()
    const token = await signToken(firstKey)

    await verifier.verify(token)
    await verifier.verify(token)

    expect(fetchCount).toBe(1)
  })

  test('refreshes a JWKS cache after its configured maximum age', async () => {
    const verifier = createVerifier({
      cooldownMilliseconds: 1_000,
      cacheMaxAgeMilliseconds: 1_000,
    })
    const token = await signToken(firstKey)

    await verifier.verify(token)
    await Bun.sleep(1_005)
    await verifier.verify(token)

    expect(fetchCount).toBe(2)
  })

  test('refetches once and accepts a rotated kid after cooldown', async () => {
    const verifier = createVerifier({
      cooldownMilliseconds: 1_000,
    })

    await verifier.verify(await signToken(firstKey))
    await Bun.sleep(1_005)
    activeKeys = [secondKey]
    const rotatedToken = await signToken(secondKey)

    const results = await Promise.all(Array.from({ length: 10 }, () => verifier.verify(rotatedToken)))

    expect(results).toHaveLength(10)
    expect(results.every((result) => result.subject === 'user-123')).toBe(true)
    expect(fetchCount).toBe(2)
  })

  test('does not create a refetch storm for an unknown kid during cooldown', async () => {
    const verifier = createVerifier({
      cooldownMilliseconds: 60_000,
    })

    await verifier.verify(await signToken(firstKey))
    activeKeys = [secondKey]
    const rotatedToken = await signToken(secondKey)

    const results = await Promise.allSettled(Array.from({ length: 10 }, () => verifier.verify(rotatedToken)))

    expect(fetchCount).toBe(1)
    expect(
      results.every(
        (result) =>
          result.status === 'rejected' &&
          result.reason instanceof KeycloakJwtVerificationError &&
          result.reason.code === 'TOKEN_KEY_REJECTED',
      ),
    ).toBe(true)
  })

  test('aborts a JWKS request at the configured timeout', async () => {
    responseDelayMilliseconds = 100
    const verifier = createVerifier({
      timeoutMilliseconds: 20,
    })

    await expectJwksUnavailable(verifier, await signToken(firstKey))
  })

  test('aborts a JWKS response body that stalls after headers', async () => {
    responseBodyDelayMilliseconds = 100
    const verifier = createVerifier({
      timeoutMilliseconds: 20,
    })

    await expectJwksUnavailable(verifier, await signToken(firstKey))
  })

  test('rejects a JWKS response larger than the configured byte limit', async () => {
    responsePaddingBytes = 2_048
    const verifier = createVerifier({
      responseSizeLimitBytes: 1_024,
    })

    await expectJwksUnavailable(verifier, await signToken(firstKey))
  })

  test('rejects invalid remote JWKS limits as configuration errors', () => {
    expect(() => createVerifier({ timeoutMilliseconds: 0 })).toThrow(KeycloakJwtConfigurationError)
    expect(() => createVerifier({ responseSizeLimitBytes: 255 })).toThrow(KeycloakJwtConfigurationError)
    expect(() => createVerifier({ cooldownMilliseconds: 0 })).toThrow(KeycloakJwtConfigurationError)
    expect(() =>
      createVerifier({
        cooldownMilliseconds: 2_000,
        cacheMaxAgeMilliseconds: 1_000,
      }),
    ).toThrow(KeycloakJwtConfigurationError)
    expect(() =>
      createKeycloakJwtVerifier({
        issuer: ISSUER,
        audience: AUDIENCE,
        jwksUri: new URL('/jwks', jwksServer.url),
        algorithms: ['RS256'],
        jwks: null as never,
      }),
    ).toThrow(KeycloakJwtConfigurationError)
  })
})

function createVerifier(jwks: NonNullable<KeycloakJwtVerifierConfig['jwks']> = {}): KeycloakJwtVerifier {
  return createKeycloakJwtVerifier({
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksUri: new URL('/jwks', jwksServer.url),
    algorithms: ['RS256'],
    jwks,
  })
}

async function createSigningKey(id: string): Promise<SigningKey> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2_048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  const exportedKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  return {
    id,
    privateKey: keyPair.privateKey,
    publicJwk: {
      ...exportedKey,
      alg: 'RS256',
      kid: id,
      use: 'sig',
    },
  }
}

async function signToken(key: SigningKey): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1_000)
  const encodedHeader = encodeJson({
    alg: 'RS256',
    kid: key.id,
    typ: 'JWT',
  })
  const encodedPayload = encodeJson({
    iss: ISSUER,
    aud: AUDIENCE,
    sub: 'user-123',
    exp: nowSeconds + 300,
    nbf: nowSeconds - 30,
  })
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key.privateKey,
    new TextEncoder().encode(signingInput),
  )

  return `${signingInput}.${Buffer.from(signature).toString('base64url')}`
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function createChunkedBody(value: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(value)
  let offset = 0
  let delayed = false

  return new ReadableStream({
    async pull(controller) {
      if (!delayed && responseBodyDelayMilliseconds > 0) {
        delayed = true
        await Bun.sleep(responseBodyDelayMilliseconds)
      }

      if (offset >= bytes.byteLength) {
        controller.close()
        return
      }

      const nextOffset = Math.min(offset + 128, bytes.byteLength)
      controller.enqueue(bytes.slice(offset, nextOffset))
      offset = nextOffset
    },
  })
}

async function expectJwksUnavailable(verifier: KeycloakJwtVerifier, token: string): Promise<void> {
  try {
    await verifier.verify(token)
    throw new Error('Expected remote JWKS verification to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(KeycloakJwtVerificationError)
    expect(error).toMatchObject({
      code: 'JWKS_UNAVAILABLE',
      message: 'Access token verification failed',
    })
    expect(error).not.toHaveProperty('cause')
  }
}
