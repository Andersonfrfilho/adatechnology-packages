import { Module, DynamicModule } from "@nestjs/common";
import { HttpModule } from "@adatechnology/http-client";

import {
  KEYCLOAK_ADMIN_CLIENT,
  KEYCLOAK_ADMIN_CONFIG,
  KEYCLOAK_ADMIN_PROVIDER,
} from "./keycloak-admin.token";
import { KeycloakAdminClient } from "./keycloak-admin.client";
import type { KeycloakAdminConfig } from "./keycloak-admin.interface";
import { validateKeycloakAdminConfig } from "./utils/validate-config";

@Module({})
export class KeycloakAdminModule {
  static forRoot(config: KeycloakAdminConfig): DynamicModule {
    validateKeycloakAdminConfig(config);

    return {
      module: KeycloakAdminModule,
      global: true,
      imports: [
        HttpModule.forRoot(
          { baseURL: config.baseUrl, timeout: 5000 },
          {
            logging: {
              enabled: true,
              includeBody: true,
              context: "KeycloakAdminHttpClient",
              environments: ["development", "test"],
            },
          },
        ),
      ],
      providers: [
        { provide: KEYCLOAK_ADMIN_CONFIG, useValue: config },
        {
          provide: KEYCLOAK_ADMIN_CLIENT,
          useClass: KeycloakAdminClient,
        },
        {
          provide: KEYCLOAK_ADMIN_PROVIDER,
          useExisting: KEYCLOAK_ADMIN_CLIENT,
        },
      ],
      exports: [
        KEYCLOAK_ADMIN_CLIENT,
        KEYCLOAK_ADMIN_PROVIDER,
        KEYCLOAK_ADMIN_CONFIG,
      ],
    };
  }
}
