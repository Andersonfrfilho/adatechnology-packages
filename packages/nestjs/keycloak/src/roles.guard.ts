import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  ROLES_META_KEY,
  B2C_ROLES_META_KEY,
  B2B_ROLES_META_KEY,
  TOKEN_ROLES_META_KEY,
  RolesOptions,
  TokenRolesOptions,
} from "./roles.decorator";
import { KEYCLOAK_CONFIG } from "./keycloak.token";
import type { KeycloakConfig, KeycloakJwtPayload } from "./keycloak.interface";
import { BaseAppError } from "@adatechnology/shared";
import { HTTP_STATUS, ROLES_ERROR_CODE } from "./keycloak.constants";
import { getB2CTokenHeader, getB2BTokenHeader } from "./keycloak.headers";

/**
 * Guard that enforces role requirements declared by @Roles, @B2CRoles, and @B2BRoles.
 *
 * Three decorator modes:
 *
 * @Roles('x')      — auto-detect token source:
 *                    X-Access-Token present → read from user JWT (B2C)
 *                    Authorization only     → read from service JWT (B2B)
 *
 * @B2CRoles('x')   — always check the user JWT in X-Access-Token
 * @B2BRoles('x')   — always check the service JWT in Authorization
 *
 * When @B2CRoles AND @B2BRoles are both declared, BOTH checks must pass.
 * This allows expressing: "the calling service must have role X AND the user must have role Y".
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Optional()
    @Inject(KEYCLOAK_CONFIG)
    private readonly config?: KeycloakConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const b2cMeta = this.getMeta(B2C_ROLES_META_KEY, context);
    const b2bMeta = this.getMeta(B2B_ROLES_META_KEY, context);
    const genericMeta = this.getMeta(ROLES_META_KEY, context);
    // getAllAndMerge concatenates arrays from multiple @TokenRoles calls
    const tokenRules = this.reflector.getAllAndMerge<TokenRolesOptions[]>(
      TOKEN_ROLES_META_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? [];

    // No role requirements declared — allow
    if (!b2cMeta && !b2bMeta && !genericMeta && tokenRules.length === 0) return true;

    // ── Explicit B2C check (X-Access-Token) ──────────────────────────────
    if (b2cMeta) {
      const token: string | undefined = req.headers?.[getB2CTokenHeader()];
      const roles = token ? this.extractRoles(token, "b2c") : new Set<string>();
      this.assertRoles(roles, b2cMeta, "B2C (user)");
    }

    // ── Explicit B2B check (Authorization) ───────────────────────────────
    if (b2bMeta) {
      const raw: string | undefined = req.headers?.[getB2BTokenHeader()];
      const token = raw?.split(" ")[1];
      const roles = token ? this.extractRoles(token, "b2b") : new Set<string>();
      this.assertRoles(roles, b2bMeta, "B2B (service)");
    }

    // ── Generic @Roles — auto-detect token source ─────────────────────────
    if (genericMeta) {
      const accessToken: string | undefined = req.headers?.[getB2CTokenHeader()];

      if (accessToken) {
        // B2C path — use user JWT
        const roles = this.extractRoles(accessToken, "b2c");
        this.assertRoles(roles, genericMeta, "B2C (user)");
      } else {
        // B2B path — use service JWT
        const raw: string | undefined = req.headers?.[getB2BTokenHeader()];
        const token = raw?.split(" ")[1] ?? (req.query?.token as string | undefined);

        if (!token) {
          throw new BaseAppError({
            message: "Authorization token not provided",
            status: HTTP_STATUS.FORBIDDEN,
            code: ROLES_ERROR_CODE.MISSING_TOKEN,
            context: {},
          });
        }

        const roles = this.extractRoles(token, "b2b");
        this.assertRoles(roles, genericMeta, "B2B (service)");
      }
    }

    // ── Dynamic @TokenRoles — each rule checked against its own header ────
    for (const rule of tokenRules) {
      const raw: string | undefined = req.headers?.[rule.header];
      const token = rule.bearer ? raw?.split(" ")[1] : raw;
      const roles = token ? this.extractRoles(token, "b2c") : new Set<string>();
      this.assertRoles(roles, { roles: rule.roles, mode: rule.mode ?? "any" }, `header:${rule.header}`);
    }

    return true;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getMeta(key: string, ctx: ExecutionContext): RolesOptions | undefined {
    return (
      this.reflector.get<RolesOptions>(key, ctx.getHandler()) ||
      this.reflector.get<RolesOptions>(key, ctx.getClass()) ||
      undefined
    );
  }

  private extractRoles(token: string, source: "b2c" | "b2b"): Set<string> {
    const payload = this.decodeJwtPayload(token);
    const roles = new Set<string>();

    // realm roles
    if (payload?.realm_access?.roles && Array.isArray(payload.realm_access.roles)) {
      payload.realm_access.roles.forEach((r) => roles.add(r));
    }

    // resource_access roles (B2B only — service account client roles)
    if (source === "b2b" && payload?.resource_access) {
      const clientId = this.config?.credentials?.clientId;
      if (clientId && payload.resource_access[clientId]?.roles) {
        payload.resource_access[clientId].roles!.forEach((r) => roles.add(r));
      }
    }

    return roles;
  }

  private assertRoles(available: Set<string>, meta: RolesOptions, label: string): void {
    const hasMatch = meta.roles.map((r) => available.has(r));
    const passed = meta.mode === "all" ? hasMatch.every(Boolean) : hasMatch.some(Boolean);

    if (!passed) {
      throw new BaseAppError({
        message: `Insufficient roles for ${label} token`,
        status: HTTP_STATUS.FORBIDDEN,
        code: ROLES_ERROR_CODE.INSUFFICIENT_ROLES,
        context: { required: meta.roles, source: label },
      });
    }
  }

  private decodeJwtPayload(token: string): KeycloakJwtPayload {
    try {
      const parts = token.split(".");
      if (parts.length < 2) return {};
      const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const BufferCtor = (
        globalThis as unknown as {
          Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } };
        }
      ).Buffer;
      if (!BufferCtor) return {};
      return JSON.parse(BufferCtor.from(padded, "base64").toString("utf8")) as KeycloakJwtPayload;
    } catch {
      return {};
    }
  }
}
