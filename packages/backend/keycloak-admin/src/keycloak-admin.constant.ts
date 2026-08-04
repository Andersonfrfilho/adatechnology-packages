export const KEYCLOAK_ADMIN_GRANT_TYPE_CLIENT_CREDENTIALS = 'client_credentials'
export const KEYCLOAK_ADMIN_FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded'
export const KEYCLOAK_ADMIN_JSON_CONTENT_TYPE = 'application/json'
export const KEYCLOAK_ADMIN_REDACTED = '[REDACTED]'

// Renova enquanto o token ainda vale: a janela cobre o voo da requisição seguinte.
export const KEYCLOAK_ADMIN_TOKEN_RENEWAL_SKEW_MS = 30_000

export const KEYCLOAK_ADMIN_ERROR_CODE = {
  CONFIGURATION_INVALID: 'KEYCLOAK_ADMIN_CONFIGURATION_INVALID',
  REQUEST_FAILED: 'KEYCLOAK_ADMIN_REQUEST_FAILED',
  TOKEN_REQUEST_FAILED: 'KEYCLOAK_ADMIN_TOKEN_REQUEST_FAILED',
  TOKEN_RESPONSE_INVALID: 'KEYCLOAK_ADMIN_TOKEN_RESPONSE_INVALID',
  USER_ALREADY_EXISTS: 'KEYCLOAK_ADMIN_USER_ALREADY_EXISTS',
  USER_ID_MISSING: 'KEYCLOAK_ADMIN_USER_ID_MISSING',
  USER_NOT_FOUND: 'KEYCLOAK_ADMIN_USER_NOT_FOUND',
} as const

export type KeycloakAdminErrorCode = (typeof KEYCLOAK_ADMIN_ERROR_CODE)[keyof typeof KEYCLOAK_ADMIN_ERROR_CODE]

type BuildKeycloakAdminEndpointsParams = {
  readonly baseUrl: string
  readonly realm: string
}

export function buildKeycloakAdminEndpoints({ baseUrl, realm }: BuildKeycloakAdminEndpointsParams) {
  const origin = baseUrl.replace(/\/+$/, '')
  const encodedRealm = encodeURIComponent(realm)
  const users = `${origin}/admin/realms/${encodedRealm}/users`

  return {
    token: `${origin}/realms/${encodedRealm}/protocol/openid-connect/token`,
    user: (userId: string) => `${users}/${encodeURIComponent(userId)}`,
    userPassword: (userId: string) => `${users}/${encodeURIComponent(userId)}/reset-password`,
    users,
  } as const
}

export type KeycloakAdminEndpoints = ReturnType<typeof buildKeycloakAdminEndpoints>
