/**
 * Runtime-configurable header names and JWT claim names for the B2B/B2C auth flow.
 *
 * Priority (highest → lowest):
 *   1. KeycloakModule.forRoot({ headers, claims }) — programmatic config
 *   2. process.env vars — set in .env files
 *   3. Built-in defaults
 *
 * Environment variables:
 *   KEYCLOAK_B2C_TOKEN_HEADER  — header for the user JWT       (default: x-access-token)
 *   KEYCLOAK_B2B_TOKEN_HEADER  — header for the service token  (default: authorization)
 *   KEYCLOAK_USER_ID_CLAIM     — claim(s) for user ID, comma-separated  (default: sub)
 *   KEYCLOAK_CALLER_ID_CLAIM   — claim(s) for caller ID, comma-separated (default: azp)
 *
 * Multiple claims example (first non-empty value wins):
 *   KEYCLOAK_USER_ID_CLAIM=preferred_username,email,sub
 *   KEYCLOAK_CALLER_ID_CLAIM=client_id,azp
 */

export interface TokenHeaderConfig {
  /** Header name for the B2C user JWT forwarded by Kong. Default: 'x-access-token' */
  b2cToken?: string;
  /** Header name for the B2B service account token. Default: 'authorization' */
  b2bToken?: string;
}

export interface TokenClaimConfig {
  /**
   * Claim name(s) for the user identifier (from the B2C token).
   * When an array, the first non-empty value found in the JWT is returned.
   * Default: ['sub']
   */
  userId?: string | string[];
  /**
   * Claim name(s) for the caller/client identifier (from the B2B token).
   * When an array, the first non-empty value found in the JWT is returned.
   * Default: ['azp']
   */
  callerId?: string | string[];
}

// ── Singleton state ────────────────────────────────────────────────────────

const state = {
  headers: {
    b2cToken: parseEnvHeader("KEYCLOAK_B2C_TOKEN_HEADER", "x-access-token"),
    b2bToken: parseEnvHeader("KEYCLOAK_B2B_TOKEN_HEADER", "authorization"),
  },
  claims: {
    userId: parseEnvClaims("KEYCLOAK_USER_ID_CLAIM", ["sub"]),
    callerId: parseEnvClaims("KEYCLOAK_CALLER_ID_CLAIM", ["azp"]),
  },
};

// ── Configuration (called by KeycloakModule.forRoot) ──────────────────────

export function configureTokenHeaders(cfg: TokenHeaderConfig): void {
  if (cfg.b2cToken) state.headers.b2cToken = cfg.b2cToken.toLowerCase();
  if (cfg.b2bToken) state.headers.b2bToken = cfg.b2bToken.toLowerCase();
}

export function configureTokenClaims(cfg: TokenClaimConfig): void {
  if (cfg.userId) state.claims.userId = normalizeClaims(cfg.userId);
  if (cfg.callerId) state.claims.callerId = normalizeClaims(cfg.callerId);
}

// ── Getters (used by guards and decorators) ───────────────────────────────

export function getB2CTokenHeader(): string {
  return state.headers.b2cToken;
}

export function getB2BTokenHeader(): string {
  return state.headers.b2bToken;
}

/** Returns the ordered list of claims to try for the user ID. */
export function getUserIdClaims(): string[] {
  return state.claims.userId;
}

/** Returns the ordered list of claims to try for the caller ID. */
export function getCallerIdClaims(): string[] {
  return state.claims.callerId;
}

// ── Parsing helpers ────────────────────────────────────────────────────────

function parseEnvHeader(key: string, fallback: string): string {
  return (process.env[key] ?? fallback).toLowerCase();
}

function parseEnvClaims(key: string, fallback: string[]): string[] {
  const raw = process.env[key];
  if (!raw) return fallback;
  return raw.split(",").map((c) => c.trim()).filter(Boolean);
}

function normalizeClaims(value: string | string[]): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value.split(",").map((c) => c.trim()).filter(Boolean);
}
