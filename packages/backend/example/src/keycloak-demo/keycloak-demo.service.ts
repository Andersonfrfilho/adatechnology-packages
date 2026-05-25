import { Inject, Injectable } from '@nestjs/common';
import type { KeycloakClientInterface, KeycloakTokenResponse } from '@adatechnology/auth-keycloak';
import { KEYCLOAK_CLIENT } from '@adatechnology/auth-keycloak';

@Injectable()
export class KeycloakDemoService {
  constructor(
    @Inject(KEYCLOAK_CLIENT)
    private readonly keycloakClient: KeycloakClientInterface,
  ) {}

  getAccessToken(): Promise<string> {
    return this.keycloakClient.getAccessToken();
  }

  getUserInfo(token: string): Promise<Record<string, unknown>> {
    return this.keycloakClient.getUserInfo(token);
  }

  validateToken(token: string): Promise<boolean> {
    return this.keycloakClient.validateToken(token);
  }

  refreshToken(refreshToken: string): Promise<KeycloakTokenResponse> {
    return this.keycloakClient.refreshToken(refreshToken);
  }

  loginWithCredentials(username: string, password: string): Promise<KeycloakTokenResponse> {
    return this.keycloakClient.getTokenWithCredentials({ username, password });
  }

  clearTokenCache(): Promise<void> {
    return this.keycloakClient.clearTokenCache();
  }
}
