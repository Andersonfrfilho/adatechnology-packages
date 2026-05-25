import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiAuthGuard,
  AuthUser,
  B2BGuard,
  B2BRoles,
  B2CGuard,
  B2CRoles,
  BearerTokenGuard,
  CallerToken,
  AccessToken,
  Roles,
  RolesGuard,
  TokenRoles,
} from '@adatechnology/auth-keycloak';

/**
 * Demonstrates all auth patterns supported by @adatechnology/auth-keycloak.
 *
 * Header contract (set by Kong):
 *   Authorization: Bearer <service_token>   → B2B caller identity
 *   X-Access-Token: <user_jwt>              → B2C user context
 */
@Controller('secure')
export class SecureController {
  // ── Public ──────────────────────────────────────────────────────────────

  /** No authentication required */
  @Get('public')
  public() {
    return { msg: 'public' };
  }

  // ── B2C — user routed by Kong ─────────────────────────────────────────

  /**
   * Only accessible for users routed through Kong.
   * Kong validates the JWT via JWKS and forwards X-Access-Token.
   * B2CGuard asserts X-Access-Token is present.
   * RolesGuard decodes realm_access.roles from X-Access-Token.
   */
  @Get('b2c/me')
  @Roles('user-manager')
  @UseGuards(B2CGuard, RolesGuard)
  b2cMe(
    @AuthUser() id: string,                              // sub (default)
    @AuthUser('email') email: string,                    // single claim
    @AuthUser(['preferred_username', 'email']) name: string, // first non-empty
    @AccessToken() rawToken: string,                     // full JWT string
  ) {
    return { id, email, name, tokenLength: rawToken.length };
  }

  /**
   * Custom header override per-route.
   * If this service receives the token in a non-standard header, pass it explicitly.
   */
  @Get('b2c/custom-header')
  @UseGuards(B2CGuard)
  b2cCustomHeader(
    @AuthUser({ header: 'x-access-token', claim: ['sub', 'preferred_username'] }) id: string,
    @AccessToken('x-access-token') rawToken: string,
  ) {
    return { id, tokenLength: rawToken.length };
  }

  // ── B2B — service-to-service ─────────────────────────────────────────

  /**
   * Only accessible by internal services (BFF, Worker, Cron).
   * BearerTokenGuard validates the service account token via Keycloak introspection.
   * RolesGuard decodes realm_access.roles from the Authorization JWT.
   */
  @Get('b2b/internal')
  @Roles('manage-requests')
  @UseGuards(BearerTokenGuard, RolesGuard)
  b2bInternal(
    @CallerToken() clientId: string,                    // azp (default) → e.g. 'domestic-backend-bff'
    @CallerToken('sub') serviceAccountId: string,       // service account sub
    @CallerToken(['client_id', 'azp']) caller: string,  // first non-empty
  ) {
    return { clientId, serviceAccountId, caller };
  }

  /**
   * B2BGuard — lighter alternative to BearerTokenGuard when used behind Kong.
   * Kong already validated the service token; B2BGuard delegates to BearerTokenGuard.
   */
  @Get('b2b/notify')
  @Roles('send-notifications')
  @UseGuards(B2BGuard, RolesGuard)
  b2bNotify(
    @CallerToken({ header: 'authorization', claim: 'azp' }) caller: string,
  ) {
    return { msg: 'notification dispatched', caller };
  }

  // ── Both paths — ApiAuthGuard ─────────────────────────────────────────

  /**
   * Accessible by both users (via Kong) and internal services (direct B2B).
   * ApiAuthGuard detects the path:
   *   - X-Access-Token present → B2CGuard (Kong path)
   *   - Authorization only    → B2BGuard  (B2B path)
   */
  @Get('both')
  @Roles('user-manager')
  @UseGuards(ApiAuthGuard, RolesGuard)
  both(
    @AuthUser() userId: string,      // sub from X-Access-Token (empty on B2B-only path)
    @CallerToken() caller: string,   // azp from Authorization (Kong token or service token)
  ) {
    return { userId, caller };
  }

  // ── Role modes ────────────────────────────────────────────────────────

  /** ANY mode (default) — passes if the user has at least one of the listed roles */
  @Get('roles/any')
  @Roles({ roles: ['admin', 'user-manager'], mode: 'any' })
  @UseGuards(B2CGuard, RolesGuard)
  rolesAny(@AuthUser() id: string) {
    return { id, msg: 'has admin OR user-manager' };
  }

  /** ALL mode — passes only if the user has every listed role simultaneously */
  @Get('roles/all')
  @Roles({ roles: ['admin', 'user-manager'], mode: 'all' })
  @UseGuards(B2CGuard, RolesGuard)
  rolesAll(@AuthUser() id: string) {
    return { id, msg: 'has admin AND user-manager' };
  }

  // ── Roles separadas por token ─────────────────────────────────────────

  /**
   * @B2CRoles — verifica roles SOMENTE no X-Access-Token (usuário).
   * Independente de qual serviço chamou, o usuário precisa ter 'user-manager'.
   */
  @Get('roles/b2c-only')
  @B2CRoles('user-manager')
  @UseGuards(B2CGuard, RolesGuard)
  rolesB2COnly(@AuthUser() id: string) {
    return { id, msg: 'user has user-manager' };
  }

  /**
   * @B2BRoles — verifica roles SOMENTE no Authorization (serviço chamador).
   * Independente de qual usuário está autenticado, o serviço precisa ter 'manage-requests'.
   */
  @Get('roles/b2b-only')
  @B2BRoles('manage-requests')
  @UseGuards(B2BGuard, RolesGuard)
  rolesB2BOnly(@CallerToken() caller: string) {
    return { caller, msg: 'service has manage-requests' };
  }

  /**
   * @B2CRoles + @B2BRoles — AMBOS devem passar.
   *
   * Cenário: rota que exige simultaneamente:
   *   - o serviço chamador (BFF/Kong) tem 'manage-requests'  → verificado no Authorization
   *   - o usuário autenticado tem 'user-manager'             → verificado no X-Access-Token
   *
   * Ambas as verificações são independentes e ambas precisam passar.
   */
  @Get('roles/both-required')
  @B2CRoles('user-manager')          // usuário precisa desta role
  @B2BRoles('manage-requests')       // serviço precisa desta role
  @UseGuards(B2BGuard, B2CGuard, RolesGuard)
  rolesBothRequired(
    @AuthUser() userId: string,
    @CallerToken() caller: string,
  ) {
    return { userId, caller, msg: 'both checks passed' };
  }

  /**
   * @B2CRoles + @B2BRoles com opções avançadas.
   * Serviço precisa ter TODAS as roles listadas (mode: 'all').
   * Usuário precisa ter QUALQUER uma das roles (mode: 'any', default).
   */
  @Get('roles/advanced')
  @B2CRoles({ roles: ['user-manager', 'contractor'], mode: 'any' })
  @B2BRoles({ roles: ['manage-requests', 'send-notifications'], mode: 'all' })
  @UseGuards(B2BGuard, B2CGuard, RolesGuard)
  rolesAdvanced(
    @AuthUser() userId: string,
    @CallerToken() caller: string,
  ) {
    return { userId, caller, msg: 'advanced role check passed' };
  }

  // ── @TokenRoles — totalmente dinâmico por header ──────────────────────

  /**
   * @TokenRoles — você decide qual header e quais roles verificar.
   * Equivalente a @B2CRoles + @B2BRoles mas sem acoplamento ao header padrão.
   *
   * Cada @TokenRoles é verificado independentemente (AND lógico).
   * bearer: true → strip 'Bearer ' prefix (auto para 'authorization')
   */
  @Get('roles/token-dynamic')
  @TokenRoles({ header: 'x-access-token', roles: ['user-manager'] })
  @TokenRoles({ header: 'authorization',  roles: ['manage-requests'] })
  @UseGuards(B2BGuard, B2CGuard, RolesGuard)
  rolesTokenDynamic(
    @AuthUser() userId: string,
    @CallerToken() caller: string,
  ) {
    return { userId, caller, msg: 'dynamic token roles passed' };
  }

  /**
   * Header completamente customizado — qualquer JWT em qualquer header.
   * Útil para integrações com parceiros ou tokens proprietários.
   */
  @Get('roles/partner')
  @TokenRoles({ header: 'x-partner-token', roles: ['partner-api'], bearer: false })
  @UseGuards(RolesGuard)
  rolesPartner(
    @AuthUser({ header: 'x-partner-token', claim: 'sub' }) partnerId: string,
  ) {
    return { partnerId, msg: 'partner token roles passed' };
  }

  /**
   * mode: 'all' — o token precisa ter TODAS as roles listadas.
   */
  @Get('roles/token-all')
  @TokenRoles({ header: 'x-access-token', roles: ['user-manager', 'contractor'], mode: 'all' })
  @UseGuards(B2CGuard, RolesGuard)
  rolesTokenAll(@AuthUser() userId: string) {
    return { userId, msg: 'user has ALL required roles' };
  }
}
