import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { BaseAppError } from "@adatechnology/shared";
import { HTTP_STATUS, BEARER_ERROR_CODE } from "./keycloak.constants";
import { getB2CTokenHeader } from "./keycloak.headers";

/**
 * B2C Guard — validates user context on routes that receive Kong-forwarded requests.
 *
 * Kong validates the user JWT (JWKS local) and injects:
 *   - `Authorization: Bearer <service_token>` — the calling service identity (B2B)
 *   - `X-Access-Token: <user_token>`          — the original user token (B2C context)
 *   - `X-User-Id`                             — keycloak sub (extracted by Kong)
 *   - `X-User-Roles`                          — realm roles CSV (extracted by Kong)
 *
 * This guard asserts the user context headers are present.
 * It does NOT re-validate the user token — that is Kong's responsibility.
 *
 * Pair with B2BGuard (or ApiAuthGuard) + RolesGuard for full auth.
 *
 * @example
 * ```ts
 * @Get('me')
 * @Roles('user-manager')
 * @UseGuards(B2CGuard, RolesGuard)
 * async getMe(@AuthUser() keycloakId: string) { ... }
 * ```
 */
@Injectable()
export class B2CGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const accessToken: string | undefined = request.headers?.[getB2CTokenHeader()];

    if (accessToken) return true;

    throw new BaseAppError({
      message: "Missing X-Access-Token header. Route requires Kong-forwarded user authentication.",
      status: HTTP_STATUS.UNAUTHORIZED,
      code: BEARER_ERROR_CODE.MISSING_TOKEN,
      context: {},
    });
  }
}
