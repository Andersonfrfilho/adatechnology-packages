export interface KeycloakConfig {
  realm: string
  authServerUrl: string
  clientId: string
  clientSecret?: string
}

export interface KeycloakUser {
  sub: string
  email?: string
  username?: string
  name?: string
  realmRoles: string[]
  clientRoles: Record<string, string[]>
}

export interface TokenValidationResult {
  valid: boolean
  user?: KeycloakUser
  error?: string
}
