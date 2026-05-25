import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
} from "@nestjs/common";
import { getContext, LOGGER_PROVIDER } from "@adatechnology/logger";
import type { LoggerProviderInterface } from "@adatechnology/logger";
import { getHttpRequestContext } from "@adatechnology/http-client";
import { BaseAppError } from "@adatechnology/shared";

import { KEYCLOAK_CLIENT } from "./keycloak.token";
import type { KeycloakClientInterface } from "./keycloak.interface";
import {
  BEARER_ERROR_CODE,
  HTTP_STATUS,
  LIB_NAME,
  LIB_VERSION,
} from "./keycloak.constants";

/**
 * Guard that validates the Bearer token in the Authorization header via
 * Keycloak token introspection (POST /token/introspect).
 *
 * Use together with RolesGuard for B2B (service-to-service) routes that trust
 * an X-User-Id header injected by an upstream authenticated service:
 *
 * @example
 * ```ts
 * @Roles('manage-requests')
 * @UseGuards(BearerTokenGuard, RolesGuard)
 * async create(@Headers('x-user-id') keycloakId: string) {}
 * ```
 *
 * Execution order:
 *  1. BearerTokenGuard  — validates token is active (HTTP → Keycloak) → 401 on failure
 *  2. RolesGuard        — checks roles from decoded JWT payload (local) → 403 on failure
 */
@Injectable()
export class BearerTokenGuard implements CanActivate {
  private readonly className = this.constructor.name;

  private getErrorDetail(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
      return JSON.stringify(error);
    } catch {
      return "unknown error";
    }
  }

  constructor(
    @Optional()
    @Inject(KEYCLOAK_CLIENT)
    private readonly keycloakClient?: KeycloakClientInterface,
    @Optional()
    @Inject(LOGGER_PROVIDER)
    private readonly logger?: LoggerProviderInterface,
  ) {}

  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    libMethod: string,
    meta?: Record<string, unknown>,
  ) {
    if (!this.logger) return;

    const loggerCtx = getContext();
    const httpCtx = getHttpRequestContext();

    const logContext = loggerCtx?.logContext as
      | { className?: string; methodName?: string }
      | undefined;
    const requestId =
      (loggerCtx?.requestId as string | undefined) ?? httpCtx?.requestId;

    let source: string | undefined;
    if (logContext?.className && logContext?.methodName) {
      source = `${logContext.className}.${logContext.methodName}`;
    } else if (httpCtx?.className && httpCtx?.methodName) {
      source = `${httpCtx.className}.${httpCtx.methodName}`;
    }

    const payload = {
      message,
      context: this.className,
      lib: LIB_NAME,
      libVersion: LIB_VERSION,
      libMethod,
      source,
      requestId,
      meta,
    };

    if (level === "debug") this.logger.debug(payload);
    else if (level === "info") this.logger.info(payload);
    else if (level === "warn") this.logger.warn(payload);
    else if (level === "error") this.logger.error(payload);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const method = "canActivate";
    this.log("debug", `${method} - Start`, method);

    const request = context.switchToHttp().getRequest();
    const authorization: string | undefined =
      request.headers?.authorization ?? request.headers?.Authorization;

    if (!authorization?.startsWith("Bearer ")) {
      this.log(
        "warn",
        `${method} - Missing or invalid Authorization header`,
        method,
      );
      throw new BaseAppError({
        message: "Missing or invalid Authorization header",
        status: HTTP_STATUS.UNAUTHORIZED,
        code: BEARER_ERROR_CODE.MISSING_TOKEN,
        context: {},
      });
    }

    if (!this.keycloakClient) {
      this.log("error", `${method} - Keycloak client not configured`, method);
      throw new BaseAppError({
        message: "Keycloak client not configured",
        status: HTTP_STATUS.UNAUTHORIZED,
        code: BEARER_ERROR_CODE.KEYCLOAK_NOT_CONFIGURED,
        context: {},
      });
    }

    const token = authorization.slice(7);

    let isValid: boolean;
    try {
      isValid = await this.keycloakClient.validateToken(token);
    } catch (err: unknown) {
      const detail = this.getErrorDetail(err);
      this.log("error", `${method} - Token validation failed`, method, {
        detail,
      });
      throw new BaseAppError({
        message: "Token validation failed",
        status: HTTP_STATUS.UNAUTHORIZED,
        code: BEARER_ERROR_CODE.TOKEN_VALIDATION_FAILED,
        context: { detail },
      });
    }

    if (!isValid) {
      this.log("warn", `${method} - Inactive or expired token`, method);
      throw new BaseAppError({
        message: "Inactive or expired token",
        status: HTTP_STATUS.UNAUTHORIZED,
        code: BEARER_ERROR_CODE.INACTIVE_TOKEN,
        context: {},
      });
    }

    this.log("debug", `${method} - Token valid`, method);
    return true;
  }
}
