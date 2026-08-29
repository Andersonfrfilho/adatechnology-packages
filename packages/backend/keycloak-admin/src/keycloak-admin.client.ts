import {
  KEYCLOAK_ADMIN_ERROR_CODE,
  KEYCLOAK_ADMIN_JSON_CONTENT_TYPE,
  buildKeycloakAdminEndpoints,
} from './keycloak-admin.constant.js'
import { KeycloakAdminError } from './keycloak-admin.error.js'
import { createSecretRedactor } from './keycloak-admin.redaction.js'
import { readKeycloakDetail } from './keycloak-admin.response.js'
import { parseKeycloakAdminConfig } from './keycloak-admin.schema.js'
import { createKeycloakTokenProvider } from './keycloak-admin.token.js'
import type {
  CreateKeycloakAdminClientParams,
  CreateUserParams,
  CreateUserResult,
  DeleteUserParams,
  FetchLike,
  FindUserByEmailParams,
  ListUsersParams,
  ListUsersResult,
  KeycloakAdminClient,
  KeycloakUser,
  KeycloakUserAttributes,
  SetEnabledParams,
  SetPasswordParams,
  SetTemporaryPasswordParams,
  UpdateAttributesParams,
  UpdateUserParams,
} from './keycloak-admin.types.js'

const HTTP_CONFLICT = 409
const HTTP_NOT_FOUND = 404

type AdminRequestParams = {
  readonly body?: unknown
  readonly method: string
  readonly secrets?: readonly (string | undefined)[]
  readonly url: string
}

function errorCodeOf(status: number) {
  if (status === HTTP_NOT_FOUND) return KEYCLOAK_ADMIN_ERROR_CODE.USER_NOT_FOUND
  if (status === HTTP_CONFLICT) return KEYCLOAK_ADMIN_ERROR_CODE.USER_ALREADY_EXISTS
  return KEYCLOAK_ADMIN_ERROR_CODE.REQUEST_FAILED
}

function normalizeAttributes(attributes: KeycloakUserAttributes): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [key, typeof value === 'string' ? [value] : [...value]]),
  )
}

function userIdFromLocation(response: Response): string {
  const location = response.headers.get('location')
  const id = location?.split('/').filter(Boolean).at(-1)

  if (id === undefined || id === '') {
    throw new KeycloakAdminError({
      code: KEYCLOAK_ADMIN_ERROR_CODE.USER_ID_MISSING,
      message: 'Keycloak created the user without a usable Location header',
      status: response.status,
    })
  }

  return id
}

export function createKeycloakAdminClient({
  config: rawConfig,
  fetch: injectedFetch,
  now = Date.now,
}: CreateKeycloakAdminClientParams): KeycloakAdminClient {
  const config = parseKeycloakAdminConfig(rawConfig)
  const endpoints = buildKeycloakAdminEndpoints(config)
  const redactor = createSecretRedactor(config.clientSecret)
  const fetchImpl: FetchLike = injectedFetch ?? ((input, init) => globalThis.fetch(input as RequestInfo, init))

  const tokenProvider = createKeycloakTokenProvider({
    config,
    endpoint: endpoints.token,
    fetch: fetchImpl,
    now,
    redactor,
  })

  async function adminRequest({ body, method, secrets = [], url }: AdminRequestParams): Promise<Response> {
    const accessToken = await tokenProvider.getAccessToken()
    const response = await fetchImpl(url, {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { 'content-type': KEYCLOAK_ADMIN_JSON_CONTENT_TYPE }),
      },
      method,
    })

    if (response.ok) return response

    const callRedactor = redactor.with(accessToken, ...secrets)
    throw new KeycloakAdminError({
      code: errorCodeOf(response.status),
      context: callRedactor.value({
        detail: await readKeycloakDetail(response),
        method,
        realm: config.realm,
      }),
      message: callRedactor.text(`Keycloak admin request failed with status ${response.status}`),
      status: response.status,
    })
  }

  async function setPassword({ password, temporary, userId }: SetPasswordParams): Promise<void> {
    await adminRequest({
      body: { temporary, type: 'password', value: password },
      method: 'PUT',
      secrets: [password],
      url: endpoints.userPassword(userId),
    })
  }

  return {
    async createUser({
      attributes,
      email,
      emailVerified,
      enabled,
      firstName,
      lastName,
      password,
      username,
    }: CreateUserParams): Promise<CreateUserResult> {
      const response = await adminRequest({
        body: {
          ...(attributes === undefined ? {} : { attributes: normalizeAttributes(attributes) }),
          ...(password === undefined
            ? {}
            : {
                credentials: [{ temporary: password.temporary, type: 'password', value: password.value }],
              }),
          email,
          emailVerified: emailVerified ?? false,
          enabled: enabled ?? true,
          firstName,
          lastName,
          username,
        },
        method: 'POST',
        secrets: [password?.value],
        url: endpoints.users,
      })

      return { id: userIdFromLocation(response) }
    },

    async deleteUser({ userId }: DeleteUserParams): Promise<void> {
      await adminRequest({ method: 'DELETE', url: endpoints.user(userId) })
    },

    async findUserByEmail({ email }: FindUserByEmailParams): Promise<KeycloakUser | undefined> {
      const query = new URLSearchParams({ email, exact: 'true' })
      const response = await adminRequest({ method: 'GET', url: `${endpoints.users}?${query}` })
      const found = (await response.json()) as readonly KeycloakUser[]

      return found.at(0)
    },

    /**
     * Pede um a mais que o limite para saber se há próxima página sem uma segunda chamada — o
     * Keycloak não devolve total, e contar o realm inteiro só para desenhar um botão é caro.
     */
    async listUsers({ first = 0, limit = 100, search }: ListUsersParams = {}): Promise<ListUsersResult> {
      const query = new URLSearchParams({ first: String(first), max: String(limit + 1) })
      if (search !== undefined && search !== '') query.set('search', search)
      const response = await adminRequest({ method: 'GET', url: `${endpoints.users}?${query}` })
      const found = (await response.json()) as readonly KeycloakUser[]

      return { hasMore: found.length > limit, users: found.slice(0, limit) }
    },

    async setEnabled({ enabled, userId }: SetEnabledParams): Promise<void> {
      await adminRequest({ body: { enabled }, method: 'PUT', url: endpoints.user(userId) })
    },

    setPassword,

    async setTemporaryPassword({ password, userId }: SetTemporaryPasswordParams): Promise<void> {
      await setPassword({ password, temporary: true, userId })
    },

    async updateAttributes({ attributes, userId }: UpdateAttributesParams): Promise<void> {
      await adminRequest({
        body: { attributes: normalizeAttributes(attributes) },
        method: 'PUT',
        url: endpoints.user(userId),
      })
    },

    async updateUser({ user, userId }: UpdateUserParams): Promise<void> {
      await adminRequest({ body: user, method: 'PUT', url: endpoints.user(userId) })
    },
  }
}
