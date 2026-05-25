import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  HTTP_PROVIDER,
  getHttpRequestContext,
} from "@adatechnology/http-client";
import type { HttpProviderInterface } from "@adatechnology/http-client";
import {
  getContext,
  LOGGER_PROVIDER,
  LoggerProviderInterface,
} from "@adatechnology/logger";
import {
  CACHE_PROVIDER,
  InMemoryCacheProvider,
  type CacheProviderInterface,
} from "@adatechnology/cache";

import type {
  KeycloakClientInterface,
  KeycloakConfig,
  KeycloakTokenResponse,
} from "./keycloak.interface";
import { KeycloakError } from "./errors/keycloak-error";
import { extractKeycloakErrorInfo } from "./errors/utils/extract-keycloak-error-info";
import { TOKEN_CACHE_KEY, LIB_NAME, LIB_VERSION } from "./keycloak.constants";

/**
 * Minimal Keycloak client implementation without external shared infra dependencies.
 */
@Injectable()
export class KeycloakClient implements KeycloakClientInterface {
  private readonly cacheProvider: CacheProviderInterface;
  private readonly className = this.constructor.name;
  private tokenPromise?: Promise<string> | null = null;

  constructor(
    private readonly config: KeycloakConfig,
    @Inject(HTTP_PROVIDER) private readonly httpProvider: HttpProviderInterface,
    @Optional()
    @Inject(LOGGER_PROVIDER)
    private readonly logger?: LoggerProviderInterface,
    @Optional() @Inject(CACHE_PROVIDER) cacheProvider?: CacheProviderInterface,
  ) {
    this.cacheProvider = cacheProvider ?? new InMemoryCacheProvider(logger);
  }

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

  async getAccessToken(): Promise<string> {
    const method = "getAccessToken";
    this.log("debug", `${method} - Start`, method);

    // Check cache
    const cached = await this.cacheProvider.get<string>({
      key: TOKEN_CACHE_KEY,
    });
    if (cached) {
      this.log("debug", `${method} - Returning cached token`, method);
      return cached;
    }

    if (this.tokenPromise !== null && this.tokenPromise !== undefined) {
      this.log(
        "debug",
        `${method} - Waiting for existing token request`,
        method,
      );
      return this.tokenPromise;
    }

    this.tokenPromise = (async (): Promise<string> => {
      try {
        const tokenResponse = await this.requestToken();
        const ttlSeconds = this.config.tokenCacheTtl
          ? Math.floor(this.config.tokenCacheTtl / 1000)
          : tokenResponse.expires_in - 60;
        await this.cacheProvider.set({
          key: TOKEN_CACHE_KEY,
          value: tokenResponse.access_token,
          ttlInSeconds: ttlSeconds,
        });
        this.log("debug", `${method} - Token obtained and cached`, method);
        return tokenResponse.access_token;
      } finally {
        this.tokenPromise = null;
      }
    })();

    return this.tokenPromise;
  }

  async getTokenWithCredentials(params: {
    username: string;
    password: string;
  }) {
    const method = "getTokenWithCredentials";
    const { username } = params;
    this.log("info", `${method} - Start for user: ${username}`, method);

    const { password } = params;
    const tokenUrl = `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;

    const body = new URLSearchParams();
    body.append("client_id", this.config.credentials.clientId);
    body.append("grant_type", "password");
    body.append("username", username);
    body.append("password", password);
    if (this.config.credentials.clientSecret) {
      body.append("client_secret", this.config.credentials.clientSecret);
    }

    body.append("scope", KeycloakClient.scopesToString(this.config.scopes));

    try {
      const response = await this.httpProvider.post<KeycloakTokenResponse>({
        url: tokenUrl,
        data: body,
        config: {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          logContext: {
            className: this.className,
            methodName: method,
          },
        },
      });

      this.log("info", `${method} - Success for user: ${username}`, method);
      return response.data;
    } catch (err: unknown) {
      const { statusCode, details, keycloakError } =
        extractKeycloakErrorInfo(err);
      this.log("error", `${method} - Failed for user: ${username}`, method, {
        statusCode,
        keycloakError,
      });

      throw new KeycloakError("Failed to obtain token with credentials", {
        statusCode,
        details,
        keycloakError,
      });
    }
  }

  private async requestToken(): Promise<KeycloakTokenResponse> {
    const method = "requestToken";
    this.log("debug", `${method} - Start`, method);

    const tokenUrl = `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;

    const data = new URLSearchParams();
    data.append("client_id", this.config.credentials.clientId);
    data.append("grant_type", this.config.credentials.grantType);
    if (this.config.credentials.clientSecret) {
      data.append("client_secret", this.config.credentials.clientSecret);
    }

    if (this.config.credentials.grantType === "password") {
      if (
        this.config.credentials.username &&
        this.config.credentials.password
      ) {
        data.append("username", this.config.credentials.username);
        data.append("password", this.config.credentials.password);
        data.append("scope", KeycloakClient.scopesToString(this.config.scopes));
      }
    }

    try {
      const response = await this.httpProvider.post<KeycloakTokenResponse>({
        url: tokenUrl,
        data,
        config: {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          logContext: {
            className: this.className,
            methodName: method,
          },
        },
      });
      this.log("debug", `${method} - Success`, method);
      return response.data;
    } catch (err: unknown) {
      const { statusCode, details, keycloakError } =
        extractKeycloakErrorInfo(err);
      this.log("error", `${method} - Failed`, method, {
        statusCode,
        keycloakError,
      });

      throw new KeycloakError("Failed to request token", {
        statusCode,
        details,
        keycloakError,
      });
    }
  }

  async refreshToken(refreshToken: string): Promise<KeycloakTokenResponse> {
    const method = "refreshToken";
    this.log("debug", `${method} - Start`, method);

    const tokenUrl = `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;

    const data = new URLSearchParams();
    data.append("client_id", this.config.credentials.clientId);
    data.append("grant_type", "refresh_token");
    data.append("refresh_token", refreshToken);
    if (this.config.credentials.clientSecret) {
      data.append("client_secret", this.config.credentials.clientSecret);
    }

    try {
      const response = await this.httpProvider.post<KeycloakTokenResponse>({
        url: tokenUrl,
        data,
        config: {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          logContext: {
            className: this.className,
            methodName: method,
          },
        },
      });

      const ttlSeconds = this.config.tokenCacheTtl
        ? Math.floor(this.config.tokenCacheTtl / 1000)
        : response.data.expires_in - 60;
      await this.cacheProvider.set({
        key: TOKEN_CACHE_KEY,
        value: response.data.access_token,
        ttlInSeconds: ttlSeconds,
      });

      this.log("debug", `${method} - Success`, method);
      return response.data;
    } catch (err: unknown) {
      const { statusCode, details, keycloakError } =
        extractKeycloakErrorInfo(err);
      this.log("error", `${method} - Failed`, method, {
        statusCode,
        keycloakError,
      });

      throw new KeycloakError("Failed to refresh token", {
        statusCode,
        details,
        keycloakError,
      });
    }
  }

  async validateToken(token: string): Promise<boolean> {
    const method = "validateToken";
    this.log("debug", `${method} - Start`, method);

    try {
      const introspectUrl = `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/token/introspect`;

      const data = new URLSearchParams();
      data.append("token", token);
      data.append("client_id", this.config.credentials.clientId);
      if (this.config.credentials.clientSecret) {
        data.append("client_secret", this.config.credentials.clientSecret);
      }

      const response = await this.httpProvider.post<{ active: boolean }>({
        url: introspectUrl,
        data,
        config: {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          logContext: {
            className: this.className,
            methodName: method,
          },
        },
      });

      const active = response.data?.active === true;
      this.log("debug", `${method} - Success (Active: ${active})`, method);
      return active;
    } catch (error: unknown) {
      const { statusCode, details, keycloakError } =
        extractKeycloakErrorInfo(error);
      this.log("error", `${method} - Failed`, method, {
        statusCode,
        keycloakError,
      });

      throw new KeycloakError("Token introspection failed", {
        statusCode,
        details,
        keycloakError,
      });
    }
  }

  async getUserInfo(token: string): Promise<Record<string, unknown>> {
    const method = "getUserInfo";
    this.log("debug", `${method} - Start`, method);

    const userInfoUrl = `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/userinfo`;
    try {
      const response = await this.httpProvider.get<Record<string, unknown>>({
        url: userInfoUrl,
        config: {
          headers: { Authorization: `Bearer ${token}` },
          logContext: {
            className: this.className,
            methodName: method,
          },
        },
      });

      this.log("debug", `${method} - Success`, method);
      return response.data;
    } catch (err: unknown) {
      const { statusCode, details, keycloakError } =
        extractKeycloakErrorInfo(err);
      this.log("error", `${method} - Failed`, method, {
        statusCode,
        keycloakError,
      });

      throw new KeycloakError("Failed to retrieve userinfo", {
        statusCode,
        details,
        keycloakError,
      });
    }
  }

  async clearTokenCache(): Promise<void> {
    await this.cacheProvider.del({ key: TOKEN_CACHE_KEY });
  }

  private static scopesToString(scopes?: string | string[]): string {
    if (!scopes) return "openid profile email";
    return Array.isArray(scopes) ? scopes.join(" ") : String(scopes);
  }
}
