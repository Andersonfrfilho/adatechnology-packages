import { describe, expect, test } from 'bun:test'

import { createKeycloakAdminClient, PROFILE_PICTURE_ATTRIBUTE } from '../src/index.js'

const BASE_URL = 'http://keycloak.local'
const REALM = 'transportada'
const TOKEN_URL = `${BASE_URL}/realms/${REALM}/protocol/openid-connect/token`
const USER_ID = 'a1b2c3d4-0000-4000-8000-ffffffffffff'
const USER_URL = `${BASE_URL}/admin/realms/${REALM}/users/${USER_ID}`
const PROFILE_FIELDS = ['email', 'firstName', 'lastName'] as const

type StoredUser = Record<string, unknown>
type Recorded = { readonly body: StoredUser | undefined; readonly method: string; readonly url: string }

/**
 * Keycloak 26.5.2 com perfil de usuário declarativo, como medido em 16/09/2026: o `PUT` da conta com
 * `attributes` é lido como a ficha inteira — sem `username` recusa, e com `username` mas sem e-mail e
 * nome apaga os dois. `PUT` sem `attributes` mexe só no que veio.
 */
function createDeclarativeProfileKeycloak(initial: StoredUser) {
  let stored: StoredUser = structuredClone(initial)
  const calls: Recorded[] = []

  function applyUpdate(body: StoredUser): Response {
    if (!('attributes' in body)) {
      stored = { ...stored, ...body }
      return new Response(null, { status: 204 })
    }
    if (!('username' in body)) return Response.json({ errorMessage: 'User name is missing' }, { status: 400 })

    const wiped = Object.fromEntries(PROFILE_FIELDS.filter((field) => !(field in body)).map((field) => [field, null]))
    stored = { ...stored, ...body, ...wiped }
    return new Response(null, { status: 204 })
  }

  async function stubFetch(target: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(target, init)
    if (request.url.startsWith(TOKEN_URL))
      return Response.json({ access_token: 'token-1', expires_in: 300, token_type: 'Bearer' })

    const text = request.method === 'GET' ? '' : await request.text()
    const body = text === '' ? undefined : (JSON.parse(text) as StoredUser)
    calls.push({ body, method: request.method, url: request.url })

    if (request.url !== USER_URL) return new Response(null, { status: 404 })
    if (request.method === 'GET') return Response.json(stored)
    return applyUpdate(body ?? {})
  }

  return {
    calls,
    client: createKeycloakAdminClient({
      config: {
        baseUrl: BASE_URL,
        clientId: 'transportada-admin',
        clientSecret: 'segredo-de-service-account-para-contrato',
        realm: REALM,
      },
      fetch: stubFetch,
    }),
    current: () => stored,
  }
}

const ACCOUNT = {
  attributes: { company_id: ['company-1'] },
  createdTimestamp: 1_789_000_000_000,
  email: 'pessoa@empresa.test',
  emailVerified: true,
  enabled: true,
  firstName: 'Pessoa',
  id: USER_ID,
  lastName: 'de Teste',
  username: 'pessoa.teste',
}

describe('regravação de atributos no perfil declarativo do Keycloak 26', () => {
  test('updateAttributes troca o conjunto de atributos sem perder login, e-mail e nome', async () => {
    const keycloak = createDeclarativeProfileKeycloak(ACCOUNT)

    await keycloak.client.updateAttributes({ attributes: { tax_id: '00000000000' }, userId: USER_ID })

    expect(keycloak.current()).toEqual({ ...ACCOUNT, attributes: { tax_id: ['00000000000'] } })
  })

  test('updateAttributes lê a conta e regrava a representação completa', async () => {
    const keycloak = createDeclarativeProfileKeycloak(ACCOUNT)

    await keycloak.client.updateAttributes({ attributes: { company_id: 'company-2' }, userId: USER_ID })

    expect(keycloak.calls.map((call) => call.method)).toEqual(['GET', 'PUT'])
    expect(keycloak.calls[1]?.body).toEqual({ ...ACCOUNT, attributes: { company_id: ['company-2'] } })
  })

  test('setProfilePicture grava a foto sem perder login, e-mail, nome nem os outros atributos', async () => {
    const keycloak = createDeclarativeProfileKeycloak(ACCOUNT)

    await keycloak.client.setProfilePicture({ pictureUrl: 'https://cdn.test/p.png', userId: USER_ID })

    expect(keycloak.current()).toEqual({
      ...ACCOUNT,
      attributes: { company_id: ['company-1'], [PROFILE_PICTURE_ATTRIBUTE]: ['https://cdn.test/p.png'] },
    })
  })

  test('setProfilePicture faz uma leitura só antes de regravar', async () => {
    const keycloak = createDeclarativeProfileKeycloak(ACCOUNT)

    await keycloak.client.setProfilePicture({ pictureUrl: undefined, userId: USER_ID })

    expect(keycloak.calls.map((call) => call.method)).toEqual(['GET', 'PUT'])
    expect(keycloak.current()).toEqual(ACCOUNT)
  })

  test('troca de nome, e-mail, login e habilitação continuam parciais, sem leitura', async () => {
    const keycloak = createDeclarativeProfileKeycloak(ACCOUNT)

    await keycloak.client.updateUser({ user: { firstName: 'Nova', lastName: 'Pessoa' }, userId: USER_ID })
    await keycloak.client.updateUser({ user: { email: 'nova@empresa.test' }, userId: USER_ID })
    await keycloak.client.updateUser({ user: { username: 'nova.pessoa' }, userId: USER_ID })
    await keycloak.client.setEnabled({ enabled: false, userId: USER_ID })

    expect(keycloak.calls.map((call) => call.method)).toEqual(['PUT', 'PUT', 'PUT', 'PUT'])
    expect(keycloak.calls[0]?.body).toEqual({ firstName: 'Nova', lastName: 'Pessoa' })
    expect(keycloak.current()).toEqual({
      ...ACCOUNT,
      email: 'nova@empresa.test',
      enabled: false,
      firstName: 'Nova',
      lastName: 'Pessoa',
      username: 'nova.pessoa',
    })
  })

  test('conta que não existe falha na leitura, sem regravar nada', async () => {
    const keycloak = createDeclarativeProfileKeycloak(ACCOUNT)

    const failure = keycloak.client.updateAttributes({ attributes: {}, userId: 'conta-inexistente' })

    await expect(failure).rejects.toMatchObject({ code: 'KEYCLOAK_ADMIN_USER_NOT_FOUND', status: 404 })
    expect(keycloak.calls.map((call) => call.method)).toEqual(['GET'])
  })
})
