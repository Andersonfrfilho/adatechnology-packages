import {
  KEYCLOAK_ADMIN_ERROR_CODE,
  KEYCLOAK_ADMIN_FORM_CONTENT_TYPE,
  KEYCLOAK_ADMIN_GRANT_TYPE_CLIENT_CREDENTIALS,
  KEYCLOAK_ADMIN_TOKEN_RENEWAL_SKEW_MS,
} from './keycloak-admin.constant.js'
import { KeycloakAdminError } from './keycloak-admin.error.js'
import type { SecretRedactor } from './keycloak-admin.redaction.js'
import { readKeycloakDetail } from './keycloak-admin.response.js'
import type { FetchLike, KeycloakAdminConfig } from './keycloak-admin.types.js'

type TokenState = {
  readonly accessToken: string
  readonly expiresAtMs: number
}

type CreateKeycloakTokenProviderParams = {
  readonly config: KeycloakAdminConfig
  readonly endpoint: string
  readonly fetch: FetchLike
  readonly now: () => number
  readonly redactor: SecretRedactor
}

export type KeycloakTokenProvider = {
  getAccessToken(): Promise<string>
}

/**
 * Service account puro: `client_credentials`. Nenhum usuário administrador, nenhuma senha.
 */
export function createKeycloakTokenProvider({
  config,
  endpoint,
  fetch: fetchImpl,
  now,
  redactor,
}: CreateKeycloakTokenProviderParams): KeycloakTokenProvider {
  let cached: TokenState | undefined
  let inFlight: Promise<TokenState> | undefined

  function isFresh(state: TokenState): boolean {
    return state.expiresAtMs - KEYCLOAK_ADMIN_TOKEN_RENEWAL_SKEW_MS > now()
  }

  async function requestToken(): Promise<TokenState> {
    const requestedAtMs = now()
    const response = await fetchImpl(endpoint, {
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: KEYCLOAK_ADMIN_GRANT_TYPE_CLIENT_CREDENTIALS,
      }),
      headers: { 'content-type': KEYCLOAK_ADMIN_FORM_CONTENT_TYPE },
      method: 'POST',
    })

    if (!response.ok) {
      throw new KeycloakAdminError({
        code: KEYCLOAK_ADMIN_ERROR_CODE.TOKEN_REQUEST_FAILED,
        context: redactor.value({ detail: await readKeycloakDetail(response), realm: config.realm }),
        message: 'Keycloak refused the service account token request',
        status: response.status,
      })
    }

    const payload = (await response.json()) as { access_token?: unknown; expires_in?: unknown }

    if (typeof payload.access_token !== 'string' || typeof payload.expires_in !== 'number') {
      throw new KeycloakAdminError({
        code: KEYCLOAK_ADMIN_ERROR_CODE.TOKEN_RESPONSE_INVALID,
        context: { realm: config.realm },
        message: 'Keycloak returned a token response without access_token or expires_in',
        status: response.status,
      })
    }

    return {
      accessToken: payload.access_token,
      expiresAtMs: requestedAtMs + payload.expires_in * 1_000,
    }
  }

  return {
    async getAccessToken(): Promise<string> {
      if (cached && isFresh(cached)) return cached.accessToken

      inFlight ??= requestToken()

      try {
        const state = await inFlight
        cached = state
        return state.accessToken
      } finally {
        inFlight = undefined
      }
    },
  }
}
