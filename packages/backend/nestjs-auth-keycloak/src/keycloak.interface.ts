/**
 * Keycloak token response
 */
export interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  "not-before-policy": number;
  session_state: string;
  scope: string;
}

/**
 * Keycloak client credentials
 */
export interface KeycloakCredentials {
  clientId: string;
  clientSecret: string;
  username?: string;
  password?: string;
  grantType: "client_credentials" | "password";
}

/**
 * Keycloak configuration
 */
export interface KeycloakConfig {
  baseUrl: string;
  realm: string;
  credentials: KeycloakCredentials;
  /**
   * Optional scopes to request when fetching tokens. Can be a space-separated string or array of scopes.
   * Defaults to ['openid', 'profile', 'email'] when omitted.
   */
  scopes?: string | string[];
  /**
   * Optional token cache TTL in milliseconds. If provided, KeycloakClient will use this value to
   * determine how long to cache the access token instead of deriving TTL from the token's expires_in.
   */
  tokenCacheTtl?: number;
  /**
   * Header names for B2C and B2B token flows.
   * Overrides process.env values when provided.
   *
   * Env equivalents:
   *   KEYCLOAK_B2C_TOKEN_HEADER (default: 'x-access-token')
   *   KEYCLOAK_B2B_TOKEN_HEADER (default: 'authorization')
   */
  headers?: {
    /** Header carrying the user JWT forwarded by Kong. */
    b2cToken?: string;
    /** Header carrying the service account token. */
    b2bToken?: string;
  };
  /**
   * JWT claim names used to identify users and callers.
   * Overrides process.env values when provided.
   *
   * Env equivalents:
   *   KEYCLOAK_USER_ID_CLAIM   (default: 'sub')
   *   KEYCLOAK_CALLER_ID_CLAIM (default: 'azp')
   */
  claims?: {
    /**
     * Claim name(s) for the user identifier (from the B2C token).
     * When an array, the first non-empty value found in the JWT is used.
     * Env: KEYCLOAK_USER_ID_CLAIM (comma-separated). Default: 'sub'
     */
    userId?: string | string[];
    /**
     * Claim name(s) for the calling client identifier (from the B2B token).
     * When an array, the first non-empty value found in the JWT is used.
     * Env: KEYCLOAK_CALLER_ID_CLAIM (comma-separated). Default: 'azp'
     */
    callerId?: string | string[];
  };
}

/**
 * Keycloak client interface
 */
export interface KeycloakClientInterface {
  /**
   * Get access token
   */
  getAccessToken(): Promise<string>;

  /**
   * Obtain a token using resource-owner credentials (username/password).
   * Returns the full Keycloak token response so callers can access refresh tokens and other fields.
   */
  getTokenWithCredentials(params: {
    username: string;
    password: string;
  }): Promise<KeycloakTokenResponse>;

  /**
   * Refresh access token
   */
  refreshToken(refreshToken: string): Promise<KeycloakTokenResponse>;

  /**
   * Validate token
   */
  validateToken(token: string): Promise<boolean>;

  /**
   * Get user info
   */
  getUserInfo(token: string): Promise<Record<string, unknown>>;

  /**
   * Clear the internal access token cache maintained by the client.
   */
  clearTokenCache(): Promise<void>;
}

/**
 * Provider-facing interface type to be used when injecting the keycloak provider token.
 * Exported separately to make the intended injection type explicit.
 */
export type KeycloakProviderInterface = KeycloakClientInterface;

/**
 * Minimal shape for decoded JWT payloads used by the RolesGuard.
 */
export interface KeycloakJwtPayload {
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<string, { roles?: string[] }>;
  [key: string]: unknown;
}
