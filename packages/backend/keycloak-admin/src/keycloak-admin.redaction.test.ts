import { describe, expect, test } from 'bun:test'

import { KEYCLOAK_ADMIN_REDACTED } from '../src/keycloak-admin.constant.js'
import { createSecretRedactor } from '../src/keycloak-admin.redaction.js'
import {
  KEYCLOAK_ADMIN_ERROR_CODE,
  KeycloakAdminError,
  createKeycloakAdminClient,
  isKeycloakAdminError,
} from '../src/index.js'
import type { KeycloakAdminClient } from '../src/index.js'

const BASE_URL = 'http://keycloak.local'
const REALM = 'transportada'
const CLIENT_ID = 'transportada-admin'
const CLIENT_SECRET = 'segredo-de-service-account-para-contrato'
const ACCESS_TOKEN = 'token-de-acesso-que-nao-pode-vazar'
const PASSWORD = 'Senha-definitiva-da-pessoa-9'
const USER_ID = 'user-1'

const TOKEN_URL = `${BASE_URL}/realms/${REALM}/protocol/openid-connect/token`

const SECRETS = [CLIENT_SECRET, ACCESS_TOKEN, PASSWORD] as const

/**
 * Keycloak hostil: devolve de volta, no motivo do erro, tudo que recebeu — cabeçalho e corpo.
 * Se qualquer segredo escapar para o erro, escapa por aqui.
 */
function createEchoingKeycloak({ tokenFails = false }: { tokenFails?: boolean } = {}) {
  return async function stubFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(input, init)
    const body = request.method === 'GET' ? '' : await request.text()
    const echo = `authorization=${request.headers.get('authorization') ?? ''} body=${body}`

    if (request.url.startsWith(TOKEN_URL)) {
      if (tokenFails) return Response.json({ errorMessage: echo }, { status: 401 })
      return Response.json({ access_token: ACCESS_TOKEN, expires_in: 300, token_type: 'Bearer' })
    }

    return Response.json({ errorMessage: echo }, { status: 500 })
  }
}

function createClient(fetchImpl: typeof fetch | ReturnType<typeof createEchoingKeycloak>) {
  return createKeycloakAdminClient({
    config: { baseUrl: BASE_URL, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, realm: REALM },
    fetch: fetchImpl,
  })
}

function operationsOf(client: KeycloakAdminClient): ReadonlyArray<[string, () => Promise<unknown>]> {
  return [
    [
      'createUser',
      () =>
        client.createUser({
          attributes: { company_id: 'company-1' },
          email: 'admin@transportada.test',
          firstName: 'Ada',
          lastName: 'Lovelace',
          password: { temporary: false, value: PASSWORD },
          username: 'admin@transportada.test',
        }),
    ],
    ['deleteUser', () => client.deleteUser({ userId: USER_ID })],
    ['findUserByEmail', () => client.findUserByEmail({ email: 'admin@transportada.test' })],
    ['setEnabled', () => client.setEnabled({ enabled: false, userId: USER_ID })],
    ['setPassword', () => client.setPassword({ password: PASSWORD, temporary: false, userId: USER_ID })],
    ['setTemporaryPassword', () => client.setTemporaryPassword({ password: PASSWORD, userId: USER_ID })],
    ['updateAttributes', () => client.updateAttributes({ attributes: { company_id: 'company-1' }, userId: USER_ID })],
    ['updateUser', () => client.updateUser({ user: { firstName: 'Ada' }, userId: USER_ID })],
  ]
}

async function failureOf(operation: () => Promise<unknown>): Promise<KeycloakAdminError> {
  try {
    await operation()
  } catch (error) {
    if (isKeycloakAdminError(error)) return error
    throw error
  }
  throw new Error('Expected the operation to fail')
}

function surfacesOf(error: KeycloakAdminError): readonly string[] {
  return [error.message, String(error), JSON.stringify(error), JSON.stringify(error.toJSON())]
}

describe('keycloak admin error redaction', () => {
  test('no operation leaks the client secret, the access token or the password', async () => {
    const client = createClient(createEchoingKeycloak())

    for (const [name, operation] of operationsOf(client)) {
      const error = await failureOf(operation)

      for (const surface of surfacesOf(error)) {
        for (const secret of SECRETS) {
          expect(`${name}: ${surface}`).not.toContain(secret)
        }
      }
    }
  })

  test('the echoed secret is replaced, not merely absent by accident', async () => {
    const client = createClient(createEchoingKeycloak())

    const error = await failureOf(() => client.setPassword({ password: PASSWORD, temporary: false, userId: USER_ID }))

    expect(JSON.stringify(error.context)).toContain(KEYCLOAK_ADMIN_REDACTED)
    expect(error.code).toBe(KEYCLOAK_ADMIN_ERROR_CODE.REQUEST_FAILED)
    expect(error.status).toBe(500)
  })

  test('a failing token request never echoes the client secret back', async () => {
    const client = createClient(createEchoingKeycloak({ tokenFails: true }))

    const error = await failureOf(() => client.deleteUser({ userId: USER_ID }))

    expect(error.code).toBe(KEYCLOAK_ADMIN_ERROR_CODE.TOKEN_REQUEST_FAILED)
    for (const surface of surfacesOf(error)) {
      expect(surface).not.toContain(CLIENT_SECRET)
    }
    expect(JSON.stringify(error.context)).toContain(KEYCLOAK_ADMIN_REDACTED)
  })

  test('invalid configuration reports the field path, never the value', () => {
    let caught: unknown

    try {
      createKeycloakAdminClient({
        config: { baseUrl: 'nao-e-url', clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, realm: '' },
      })
    } catch (error) {
      caught = error
    }

    expect(isKeycloakAdminError(caught)).toBe(true)
    const error = caught as KeycloakAdminError
    expect(error.code).toBe(KEYCLOAK_ADMIN_ERROR_CODE.CONFIGURATION_INVALID)
    expect(error.context).toEqual({ fields: ['baseUrl', 'realm'] })
    for (const surface of surfacesOf(error)) {
      expect(surface).not.toContain(CLIENT_SECRET)
    }
  })

  test('the redactor reaches secrets nested anywhere in the error context', () => {
    const redactor = createSecretRedactor(CLIENT_SECRET).with(PASSWORD)

    const error = new KeycloakAdminError({
      code: KEYCLOAK_ADMIN_ERROR_CODE.REQUEST_FAILED,
      context: redactor.value({
        headers: [`authorization: Bearer ${CLIENT_SECRET}`],
        nested: { deep: { credentials: [{ value: PASSWORD }] } },
      }),
      message: redactor.text(`refused for ${PASSWORD}`),
    })

    for (const surface of surfacesOf(error)) {
      expect(surface).not.toContain(CLIENT_SECRET)
      expect(surface).not.toContain(PASSWORD)
    }
    expect(error.message).toBe(`refused for ${KEYCLOAK_ADMIN_REDACTED}`)
  })
})
