import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import {
  getB2CTokenHeader,
  getB2BTokenHeader,
  getUserIdClaims,
  getCallerIdClaims,
} from "./keycloak.headers";

// ── Param types ────────────────────────────────────────────────────────────

export interface AuthUserOptions {
  /**
   * Override the header to read the B2C token from.
   * Defaults to the configured B2C token header (env: KEYCLOAK_B2C_TOKEN_HEADER).
   */
  header?: string;
  /**
   * Claim name(s) to extract from the JWT payload.
   * First non-empty value wins. Defaults to configured userId claim(s).
   */
  claim?: string | string[];
}

export interface CallerTokenOptions {
  /**
   * Override the header to read the B2B token from.
   * Defaults to the configured B2B token header (env: KEYCLOAK_B2B_TOKEN_HEADER).
   */
  header?: string;
  /**
   * Claim name(s) to extract from the JWT payload.
   * First non-empty value wins. Defaults to configured callerId claim(s).
   */
  claim?: string | string[];
}

// ── Decorators ─────────────────────────────────────────────────────────────

/**
 * Extracts a claim from the user JWT forwarded by Kong in the B2C token header.
 *
 * Claims are decoded locally — no extra I/O.
 *
 * @param param - Claim name, array of claim names (first non-empty wins),
 *                or `{ header, claim }` to fully customize both.
 *
 * @example
 * ```ts
 * @AuthUser()                                          // sub (default)
 * @AuthUser('email')                                   // single claim
 * @AuthUser(['preferred_username', 'email'])            // first non-empty
 * @AuthUser({ claim: 'email', header: 'x-user-jwt' }) // custom header
 * ```
 */
export const AuthUser = createParamDecorator(
  (param: string | string[] | AuthUserOptions | undefined, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const { header, claims } = resolveB2CParam(param);
    const raw = request.headers?.[header];
    const token = Array.isArray(raw) ? raw[0] : raw;
    if (!token) return "";
    return decodeJwtClaims(String(token), claims) ?? "";
  },
);

/**
 * Extracts a claim from the service token in the B2B token header.
 *
 * Use this to identify the calling service.
 *
 * @param param - Claim name, array of claim names (first non-empty wins),
 *                or `{ header, claim }` to fully customize both.
 *
 * @example
 * ```ts
 * @CallerToken()                                              // azp (default)
 * @CallerToken('sub')                                         // single claim
 * @CallerToken(['client_id', 'azp'])                          // first non-empty
 * @CallerToken({ header: 'x-service-token', claim: 'azp' }) // custom header
 * ```
 */
export const CallerToken = createParamDecorator(
  (param: string | string[] | CallerTokenOptions | undefined, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const { header, claims } = resolveB2BParam(param);
    const raw: string | undefined = request.headers?.[header];
    const token = raw?.split(" ")[1];
    if (!token) return "";
    return decodeJwtClaims(token, claims) ?? "";
  },
);

/**
 * Extracts the raw B2C token header value (full user JWT string).
 *
 * Use this when you need the full token to pass downstream or inspect
 * non-string claims (arrays, objects). For scalar claims prefer `@AuthUser(claim)`.
 *
 * @param header - Override the header name. Defaults to configured B2C token header.
 *
 * @example
 * ```ts
 * @AccessToken()                    // reads from default B2C header
 * @AccessToken('x-user-jwt')        // reads from custom header
 * ```
 */
export const AccessToken = createParamDecorator(
  (header: string | undefined, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const h = header?.toLowerCase() ?? getB2CTokenHeader();
    const raw = request.headers?.[h];
    return Array.isArray(raw) ? raw[0] : (raw ?? "");
  },
);

// ── Resolution helpers ─────────────────────────────────────────────────────

function resolveB2CParam(param: string | string[] | AuthUserOptions | undefined): {
  header: string;
  claims: string[];
} {
  if (!param) {
    return { header: getB2CTokenHeader(), claims: getUserIdClaims() };
  }
  if (typeof param === "string") {
    return { header: getB2CTokenHeader(), claims: [param] };
  }
  if (Array.isArray(param)) {
    return { header: getB2CTokenHeader(), claims: param };
  }
  // AuthUserOptions object
  return {
    header: param.header?.toLowerCase() ?? getB2CTokenHeader(),
    claims: param.claim ? normalizeClaims(param.claim) : getUserIdClaims(),
  };
}

function resolveB2BParam(param: string | string[] | CallerTokenOptions | undefined): {
  header: string;
  claims: string[];
} {
  if (!param) {
    return { header: getB2BTokenHeader(), claims: getCallerIdClaims() };
  }
  if (typeof param === "string") {
    return { header: getB2BTokenHeader(), claims: [param] };
  }
  if (Array.isArray(param)) {
    return { header: getB2BTokenHeader(), claims: param };
  }
  // CallerTokenOptions object
  return {
    header: param.header?.toLowerCase() ?? getB2BTokenHeader(),
    claims: param.claim ? normalizeClaims(param.claim) : getCallerIdClaims(),
  };
}

function normalizeClaims(value: string | string[]): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value.split(",").map((c) => c.trim()).filter(Boolean);
}

// ── JWT helper ─────────────────────────────────────────────────────────────

/**
 * Decode the JWT payload and return the value of the first claim that exists
 * and has a non-empty string value. No signature validation — Kong already did that.
 */
function decodeJwtClaims(token: string, claims: string[]): string | undefined {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const BufferCtor = (
      globalThis as unknown as {
        Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } };
      }
    ).Buffer;
    if (!BufferCtor) return undefined;
    const payload = JSON.parse(
      BufferCtor.from(padded, "base64").toString("utf8"),
    ) as Record<string, unknown>;

    for (const claim of claims) {
      const value = payload[claim];
      if (typeof value === "string" && value.length > 0) return value;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
