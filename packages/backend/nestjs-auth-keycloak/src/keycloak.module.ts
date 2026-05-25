import { Module, DynamicModule } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { HTTP_PROVIDER, HttpModule } from "@adatechnology/http-client";
import type { HttpProviderInterface } from "@adatechnology/http-client";
import { LOGGER_PROVIDER } from "@adatechnology/logger";
import type { LoggerProviderInterface } from "@adatechnology/logger";
import { CACHE_PROVIDER } from "@adatechnology/cache";
import type { CacheProviderInterface } from "@adatechnology/cache";
import type { AxiosRequestConfig, AxiosInstance } from "axios";

import { ApiAuthGuard } from "./api-auth.guard";
import { B2BGuard } from "./b2b.guard";
import { B2CGuard } from "./b2c.guard";
import { BearerTokenGuard } from "./bearer-token.guard";
import { KeycloakClient } from "./keycloak.client";
import { KeycloakHttpInterceptor } from "./keycloak.http.interceptor";
import { RolesGuard } from "./roles.guard";
import {
  KEYCLOAK_CONFIG,
  KEYCLOAK_CLIENT,
  KEYCLOAK_HTTP_INTERCEPTOR,
  KEYCLOAK_PROVIDER,
} from "./keycloak.token";
import { KeycloakConfig } from "./keycloak.interface";
import {
  configureTokenHeaders,
  configureTokenClaims,
} from "./keycloak.headers";
import { validateKeycloakConfig } from "./validators/validate-keycloak-config";

@Module({})
export class KeycloakModule {
  static forRoot(
    config: KeycloakConfig,
    httpConfig?: AxiosRequestConfig | AxiosInstance,
  ): DynamicModule {
    validateKeycloakConfig(config);

    if (config.headers) configureTokenHeaders(config.headers);
    if (config.claims) configureTokenClaims(config.claims);

    return {
      module: KeycloakModule,
      global: true,
      imports: [
        HttpModule.forRoot(
          httpConfig || { baseURL: config.baseUrl, timeout: 5000 },
          {
            logging: {
              enabled: true,
              includeBody: true,
              context: "KeycloakHttpClient",
              environments: ["development", "test"],
            },
          },
        ),
      ],
      providers: [
        { provide: Reflector, useClass: Reflector },
        { provide: KEYCLOAK_CONFIG, useValue: config },
        {
          provide: KEYCLOAK_CLIENT,
          useFactory: (
            cfg: KeycloakConfig,
            httpProvider: HttpProviderInterface,
            logger?: LoggerProviderInterface,
            cacheProvider?: CacheProviderInterface,
          ) => new KeycloakClient(cfg, httpProvider, logger, cacheProvider),
          inject: [
            KEYCLOAK_CONFIG,
            HTTP_PROVIDER,
            { token: LOGGER_PROVIDER, optional: true },
            { token: CACHE_PROVIDER, optional: true },
          ],
        },
        {
          provide: KEYCLOAK_PROVIDER,
          useExisting: KEYCLOAK_CLIENT,
        },
        {
          provide: KEYCLOAK_HTTP_INTERCEPTOR,
          useFactory: () => new KeycloakHttpInterceptor(),
        },
        RolesGuard,
        BearerTokenGuard,
        B2CGuard,
        B2BGuard,
        ApiAuthGuard,
      ],
      exports: [
        Reflector,
        KEYCLOAK_CLIENT,
        KEYCLOAK_PROVIDER,
        KEYCLOAK_HTTP_INTERCEPTOR,
        KEYCLOAK_CONFIG,
        RolesGuard,
        BearerTokenGuard,
        B2CGuard,
        B2BGuard,
        ApiAuthGuard,
      ],
    };
  }
}
