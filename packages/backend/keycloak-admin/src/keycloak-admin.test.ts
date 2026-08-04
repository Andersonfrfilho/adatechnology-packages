import { describe, expect, test } from 'bun:test'

import { createKeycloakAdminClient } from '../src/index.js'

const BASE_URL = 'http://keycloak.local'
const REALM = 'transportada'
const CLIENT_ID = 'transportada-admin'
const CLIENT_SECRET = 'segredo-de-service-account-para-contrato'
const ADMINISTRATOR_EMAIL = 'admin@transportada.test'

const TOKEN_URL = `${BASE_URL}/realms/${REALM}/protocol/openid-connect/token`
const USERS_URL = `${BASE_URL}/admin/realms/${REALM}/users`

// Renova enquanto o token ainda vale: a janela cobre o voo da requisição seguinte.
const RENEWAL_SKEW_MS = 30_000

type RecordedRequest = {
  readonly authorization: string | undefined
  readonly body: string
  readonly contentType: string | undefined
  readonly method: string
  readonly url: string
}

type KeycloakStubParams = {
  readonly expiresIn?: number
}

function createKeycloakStub({ expiresIn = 300 }: KeycloakStubParams = {}) {
  const requests: RecordedRequest[] = []
  let issuedTokens = 0

  async function stubFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(input, init)
    const body = request.method === 'GET' ? '' : await request.text()

    requests.push({
      authorization: request.headers.get('authorization') ?? undefined,
      body,
      contentType: request.headers.get('content-type') ?? undefined,
      method: request.method,
      url: request.url,
    })

    if (request.url.startsWith(TOKEN_URL)) {
      issuedTokens += 1
      return Response.json({
        access_token: `token-${issuedTokens}`,
        expires_in: expiresIn,
        token_type: 'Bearer',
      })
    }

    return Response.json([{ email: ADMINISTRATOR_EMAIL, id: 'user-1', username: ADMINISTRATOR_EMAIL }])
  }

  return {
    adminRequests: () => requests.filter((request) => request.url.startsWith(USERS_URL)),
    requests,
    stubFetch,
    tokenRequests: () => requests.filter((request) => request.url.startsWith(TOKEN_URL)),
  }
}

function createClock(start = 1_700_000_000_000) {
  let current = start
  return {
    advance(milliseconds: number) {
      current += milliseconds
    },
    now: () => current,
  }
}

type ClientParams = {
  readonly clock?: ReturnType<typeof createClock>
  readonly stub: ReturnType<typeof createKeycloakStub>
}

function createClient({ clock = createClock(), stub }: ClientParams) {
  return createKeycloakAdminClient({
    config: {
      baseUrl: BASE_URL,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      realm: REALM,
    },
    fetch: stub.stubFetch,
    now: clock.now,
  })
}

describe('keycloak admin client token', () => {
  test('asks for the token as a service account, with client credentials', async () => {
    const stub = createKeycloakStub()
    const client = createClient({ stub })

    await client.findUserByEmail({ email: ADMINISTRATOR_EMAIL })

    const [tokenRequest] = stub.tokenRequests()
    expect(tokenRequest?.method).toBe('POST')
    expect(tokenRequest?.contentType).toContain('application/x-www-form-urlencoded')

    const form = new URLSearchParams(tokenRequest?.body ?? '')
    expect(form.get('grant_type')).toBe('client_credentials')
    expect(form.get('client_id')).toBe(CLIENT_ID)
    expect(form.get('client_secret')).toBe(CLIENT_SECRET)
  })

  test('never sends a password nor a username to obtain the token', async () => {
    const stub = createKeycloakStub()
    const client = createClient({ stub })

    await client.findUserByEmail({ email: ADMINISTRATOR_EMAIL })

    for (const request of stub.requests) {
      const form = new URLSearchParams(request.body)
      expect(form.get('password')).toBeNull()
      expect(form.get('username')).toBeNull()
      expect(request.body).not.toContain('grant_type=password')
    }
  })

  test('reuses the cached token while it is still valid', async () => {
    const stub = createKeycloakStub({ expiresIn: 300 })
    const clock = createClock()
    const client = createClient({ clock, stub })

    await client.findUserByEmail({ email: ADMINISTRATOR_EMAIL })
    clock.advance(60_000)
    await client.findUserByEmail({ email: ADMINISTRATOR_EMAIL })

    expect(stub.tokenRequests()).toHaveLength(1)
    expect(stub.adminRequests().map((request) => request.authorization)).toEqual(['Bearer token-1', 'Bearer token-1'])
  })

  test('renews the token before it expires, not after', async () => {
    const expiresIn = 120
    const stub = createKeycloakStub({ expiresIn })
    const clock = createClock()
    const client = createClient({ clock, stub })

    await client.findUserByEmail({ email: ADMINISTRATOR_EMAIL })

    clock.advance(expiresIn * 1_000 - RENEWAL_SKEW_MS - 1_000)
    await client.findUserByEmail({ email: ADMINISTRATOR_EMAIL })
    expect(stub.tokenRequests()).toHaveLength(1)

    clock.advance(2_000)
    await client.findUserByEmail({ email: ADMINISTRATOR_EMAIL })
    expect(stub.tokenRequests()).toHaveLength(2)

    expect(stub.adminRequests().at(-1)?.authorization).toBe('Bearer token-2')
  })
})
