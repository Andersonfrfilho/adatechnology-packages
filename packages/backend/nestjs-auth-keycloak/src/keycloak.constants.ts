import pkg from "../package.json";

// ── Lib metadata (auto-read from package.json) ────────────────────────────────

export const LIB_NAME = pkg.name;
export const LIB_VERSION = pkg.version;

// ── Cache ─────────────────────────────────────────────────────────────────────

export const TOKEN_CACHE_KEY = "keycloak:access_token";

// ── HTTP status codes ─────────────────────────────────────────────────────────

export const HTTP_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
} as const;

// ── Error codes — BearerTokenGuard (401) ──────────────────────────────────────

export const BEARER_ERROR_CODE = {
  MISSING_TOKEN: "UNAUTHORIZED_MISSING_TOKEN",
  KEYCLOAK_NOT_CONFIGURED: "UNAUTHORIZED_KEYCLOAK_NOT_CONFIGURED",
  TOKEN_VALIDATION_FAILED: "UNAUTHORIZED_TOKEN_VALIDATION_FAILED",
  INACTIVE_TOKEN: "UNAUTHORIZED_INACTIVE_TOKEN",
} as const;

// ── Error codes — RolesGuard (403) ────────────────────────────────────────────

export const ROLES_ERROR_CODE = {
  MISSING_TOKEN: "FORBIDDEN_MISSING_TOKEN",
  INSUFFICIENT_ROLES: "FORBIDDEN_INSUFFICIENT_ROLES",
} as const;
