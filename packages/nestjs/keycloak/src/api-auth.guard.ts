import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { BaseAppError } from "@adatechnology/shared";
import { B2BGuard } from "./b2b.guard";
import { B2CGuard } from "./b2c.guard";
import { HTTP_STATUS, BEARER_ERROR_CODE } from "./keycloak.constants";
import { getB2CTokenHeader, getB2BTokenHeader } from "./keycloak.headers";

/**
 * ApiAuthGuard — composite guard for routes that accept both paths.
 *
 * Detects which path the request is coming from and delegates accordingly:
 *
 * - **B2B path** (Authorization header present):
 *   Service-to-service call (e.g. BFF → API). Delegates to B2BGuard,
 *   which validates the service account token via BearerTokenGuard.
 *
 * - **B2C path** (X-User-Id header present, no Authorization):
 *   User call routed by Kong. Delegates to B2CGuard,
 *   which asserts Kong identity headers are present.
 *
 * Use when the same route must be reachable both from Kong (users) and
 * from internal services (BFF, Worker). If the route is exclusive to one
 * path, prefer B2BGuard or B2CGuard directly for explicit intent.
 *
 * @example
 * ```ts
 * @Get('me')
 * @Roles('user-manager')
 * @UseGuards(ApiAuthGuard, RolesGuard)
 * async getMe(@AuthUser() keycloakId: string) { ... }
 * ```
 */
@Injectable()
export class ApiAuthGuard implements CanActivate {
  constructor(
    private readonly b2bGuard: B2BGuard,
    private readonly b2cGuard: B2CGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // B2C path — Kong-routed user request: B2C token header present
    // (Kong also sets B2B Authorization, so check B2C first to avoid ambiguity)
    const accessToken: string | undefined = request.headers?.[getB2CTokenHeader()];

    if (accessToken) {
      return this.b2cGuard.canActivate(context);
    }

    // B2B path — direct service-to-service call: only B2B token present
    const authHeader: string | undefined = request.headers?.[getB2BTokenHeader()];

    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      return this.b2bGuard.canActivate(context);
    }

    throw new BaseAppError({
      message: "Unauthorized: missing X-Access-Token (Kong/B2C) or Authorization header (B2B)",
      status: HTTP_STATUS.UNAUTHORIZED,
      code: BEARER_ERROR_CODE.MISSING_TOKEN,
      context: {},
    });
  }
}
