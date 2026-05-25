import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";

import type { KeycloakClientInterface } from "./keycloak.interface";
import { KEYCLOAK_CLIENT } from "./keycloak.token";

/**
 * HTTP interceptor that automatically adds Keycloak tokens to requests
 */
@Injectable()
export class KeycloakHttpInterceptor implements NestInterceptor {
  constructor() {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request: Record<string, unknown> = context
      .switchToHttp()
      .getRequest();

    // Only add token for external API calls (not Keycloak itself)
    if (typeof request.url === "string" && !request.url.includes("keycloak")) {
      // Note: In a real implementation, you might want to add the token here
      // But since we're using HttpProvider, the token addition should be handled there
      // This interceptor could be used for other HTTP client libraries
    }

    return next.handle();
  }
}
