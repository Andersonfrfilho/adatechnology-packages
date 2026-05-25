import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { BearerTokenGuard } from "./bearer-token.guard";

/**
 * B2B Guard — service-to-service routes (e.g. BFF → API, Worker → API).
 *
 * The caller must send a valid service account token (client_credentials)
 * in the Authorization header. Delegates full token validation to
 * BearerTokenGuard (Keycloak introspection).
 *
 * The caller is also expected to forward X-User-Id so the API knows which
 * end-user context the call belongs to.
 *
 * Use for routes that are ONLY called by internal services, not by end users.
 *
 * @example
 * ```ts
 * @Post('internal/notify')
 * @Roles('send-notifications')
 * @UseGuards(B2BGuard, RolesGuard)
 * async notify(@AuthUser() keycloakId: string) { ... }
 * ```
 */
@Injectable()
export class B2BGuard implements CanActivate {
  constructor(private readonly bearerTokenGuard: BearerTokenGuard) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(this.bearerTokenGuard.canActivate(context));
  }
}
