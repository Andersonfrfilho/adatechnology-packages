import { SetMetadata } from "@nestjs/common";

export const ROLES_META_KEY = "roles";
export const B2C_ROLES_META_KEY = "roles:b2c";
export const B2B_ROLES_META_KEY = "roles:b2b";
export const TOKEN_ROLES_META_KEY = "roles:token";

export type RolesMode = "any" | "all";
export type RolesType = "realm" | "client" | "both";

export interface TokenRolesOptions {
  /** Header name where the JWT lives. E.g. 'x-access-token', 'authorization'. */
  header: string;
  /** Roles required from that token. */
  roles: string[];
  /** Match mode. Default: 'any' (at least one role must match). */
  mode?: RolesMode;
  /**
   * If true, strips the 'Bearer ' prefix before decoding.
   * Auto-detected when omitted: stripped when header is 'authorization'.
   */
  bearer?: boolean;
}

export type RolesOptions = {
  roles: string[];
  mode?: RolesMode; // default: any
  type?: RolesType; // default: both
};

/**
 * Declares required roles without specifying the token source.
 * RolesGuard resolves the token automatically:
 *   - X-Access-Token present → reads from user JWT (B2C)
 *   - Authorization only     → reads from service JWT (B2B)
 *
 * @example
 *  @Roles('admin')
 *  @Roles('admin', 'editor')
 *  @Roles({ roles: ['admin', 'editor'], mode: 'all' })
 */
export function Roles(...args: Array<string | string[] | RolesOptions>) {
  return SetMetadata(ROLES_META_KEY, normalizeRolesOptions(args));
}

/**
 * Declares roles that must be present in the **user JWT** (`X-Access-Token`).
 * Checked independently from B2BRoles — both must pass when both are declared.
 *
 * Use when the route requires a specific user role regardless of which service called it.
 *
 * @example
 *  @B2CRoles('user-manager')
 *  @B2CRoles({ roles: ['admin', 'user-manager'], mode: 'all' })
 */
export function B2CRoles(...args: Array<string | string[] | RolesOptions>) {
  return SetMetadata(B2C_ROLES_META_KEY, normalizeRolesOptions(args));
}

/**
 * Declares roles that must be present in the **service token** (`Authorization`).
 * Checked independently from B2CRoles — both must pass when both are declared.
 *
 * Use when the route requires the calling service to have a specific role,
 * regardless of which user triggered the request.
 *
 * @example
 *  @B2BRoles('manage-requests')
 *  @B2BRoles({ roles: ['manage-requests', 'send-notifications'], mode: 'any' })
 */
export function B2BRoles(...args: Array<string | string[] | RolesOptions>) {
  return SetMetadata(B2B_ROLES_META_KEY, normalizeRolesOptions(args));
}

// ── Internal ───────────────────────────────────────────────────────────────

function normalizeRolesOptions(args: Array<string | string[] | RolesOptions>): RolesOptions {
  let payload: RolesOptions;

  if (
    args.length === 1 &&
    typeof args[0] === "object" &&
    !Array.isArray(args[0])
  ) {
    payload = args[0] as RolesOptions;
  } else {
    const roles: string[] = ([] as string[]).concat(
      ...(args.map((a) => (Array.isArray(a) ? a : String(a))) as string[]),
    );
    payload = { roles };
  }

  payload.mode = payload.mode ?? "any";
  payload.type = payload.type ?? "both";
  return payload;
}

/**
 * Declares role requirements tied to a specific JWT header.
 * Fully dynamic — works with any header that carries a JWT.
 *
 * Multiple uses are accumulated (AND logic): every @TokenRoles block must pass.
 * Uses Reflector.getAllAndMerge internally, so stacking works correctly.
 *
 * @example
 * // Verify user roles from X-Access-Token AND service roles from Authorization:
 * @TokenRoles({ header: 'x-access-token', roles: ['user-manager'] })
 * @TokenRoles({ header: 'authorization',  roles: ['manage-requests'] })
 * @UseGuards(B2BGuard, B2CGuard, RolesGuard)
 *
 * // Custom token header with ALL mode:
 * @TokenRoles({ header: 'x-partner-token', roles: ['partner-admin', 'partner-api'], mode: 'all' })
 * @UseGuards(RolesGuard)
 */
export function TokenRoles(options: TokenRolesOptions) {
  const normalized: TokenRolesOptions = {
    ...options,
    header: options.header.toLowerCase(),
    mode: options.mode ?? "any",
    // auto-detect bearer stripping: true when header is 'authorization'
    bearer: options.bearer ?? options.header.toLowerCase() === "authorization",
  };
  // Stored as single-element array so Reflector.getAllAndMerge concatenates multiple calls
  return SetMetadata(TOKEN_ROLES_META_KEY, [normalized]);
}

export default Roles;
