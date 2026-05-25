import { Controller, Get, Post, Body, Query, Inject, UseGuards } from '@nestjs/common';
import { getContext, LOGGER_PROVIDER, LoggerProviderInterface, runWithContext } from '@adatechnology/logger';
import { Roles, RolesGuard } from '@adatechnology/auth-keycloak';
import { KeycloakDemoService } from './keycloak-demo.service';

@Controller('keycloak')
export class KeycloakDemoController {
  constructor(
    private readonly svc: KeycloakDemoService,
    @Inject(LOGGER_PROVIDER) private readonly logger?: LoggerProviderInterface,
  ) {}

  /** Propagates logContext through AsyncLocalStorage so downstream libs (keycloak, cache) can read it */
  private withCtx<T>(logContext: object, fn: () => Promise<T>): Promise<T> {
    return runWithContext({ ...(getContext() ?? {}), logContext }, fn);
  }

  @Get('token')
  async token() {
    const logContext = { className: KeycloakDemoController.name, methodName: 'token' };
    this.logger?.info({ message: 'Get token start', context: KeycloakDemoController.name, meta: { logContext } });

    const access_token = await this.withCtx(logContext, () => this.svc.getAccessToken());

    this.logger?.info({ message: 'Get token end', context: KeycloakDemoController.name, meta: { logContext } });
    return { access_token };
  }

  @Post('login')
  async login(@Body() body: { username?: string; password?: string }) {
    const logContext = { className: KeycloakDemoController.name, methodName: 'login' };
    const { username, password } = body || {};

    if (!username || !password) {
      return { error: 'username and password required in body' };
    }

    this.logger?.info({ message: 'Login start', context: KeycloakDemoController.name, meta: { username, logContext } });

    const tokenResponse = await this.withCtx(logContext, () =>
      this.svc.loginWithCredentials(username, password),
    );

    this.logger?.info({ message: 'Login end', context: KeycloakDemoController.name, meta: { username, logContext } });
    return tokenResponse;
  }

  @Get('userinfo')
  async userinfo(@Query('token') token: string) {
    const logContext = { className: KeycloakDemoController.name, methodName: 'userinfo' };

    if (!token) {
      return { error: 'query param token is required' };
    }

    this.logger?.info({ message: 'Get userinfo start', context: KeycloakDemoController.name, meta: { logContext } });

    const info = await this.withCtx(logContext, () => this.svc.getUserInfo(token));

    this.logger?.info({ message: 'Get userinfo end', context: KeycloakDemoController.name, meta: { logContext } });
    return info;
  }

  @Get('validate')
  async validate(@Query('token') token: string) {
    const logContext = { className: KeycloakDemoController.name, methodName: 'validate' };

    if (!token) {
      return { error: 'query param token is required' };
    }

    this.logger?.info({ message: 'Validate token start', context: KeycloakDemoController.name, meta: { logContext } });

    const valid = await this.withCtx(logContext, () => this.svc.validateToken(token));

    this.logger?.info({ message: 'Validate token end', context: KeycloakDemoController.name, meta: { valid, logContext } });
    return { valid };
  }

  @Post('refresh')
  async refresh(@Body() body: { refresh_token?: string }) {
    const logContext = { className: KeycloakDemoController.name, methodName: 'refresh' };

    if (!body?.refresh_token) {
      return { error: 'refresh_token is required in body' };
    }

    this.logger?.info({ message: 'Refresh token start', context: KeycloakDemoController.name, meta: { logContext } });

    const tokenResponse = await this.withCtx(logContext, () =>
      this.svc.refreshToken(body.refresh_token!),
    );

    this.logger?.info({ message: 'Refresh token end', context: KeycloakDemoController.name, meta: { logContext } });
    return tokenResponse;
  }

  @Get('clear-cache')
  async clearCache() {
    const logContext = { className: KeycloakDemoController.name, methodName: 'clearCache' };
    this.logger?.info({ message: 'Clear token cache', context: KeycloakDemoController.name, meta: { logContext } });

    await this.svc.clearTokenCache();

    return { cleared: true };
  }

  // ── Role-protected routes ─────────────────────────────────────────────────

  @Get('secure/public')
  @UseGuards(RolesGuard)
  securePublic() {
    return { message: 'Public access OK' };
  }

  @Get('secure/admin')
  @UseGuards(RolesGuard)
  @Roles('admin')
  secureAdmin() {
    return { message: 'Admin access OK' };
  }

  @Get('secure/whoami')
  whoami(@Query('token') token?: string) {
    return { tokenProvided: !!token };
  }
}
