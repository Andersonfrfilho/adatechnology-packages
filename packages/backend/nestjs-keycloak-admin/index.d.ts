import { DynamicModule } from "@nestjs/common";

export interface KeycloakAdminConfig {
  baseUrl: string;
  realm: string;
  adminUser: string;
  adminPassword: string;
}

export interface GetAdminTokenResult {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface UpdateUserParams {
  userId: string;
  userData: Record<string, unknown>;
  adminToken: string;
}

export interface ResetPasswordParams {
  userId: string;
  password: string;
  temporary: boolean;
  adminToken: string;
}

export interface ToggleUserEnabledParams {
  userId: string;
  enabled: boolean;
  adminToken: string;
}

export interface DeleteUserParams {
  userId: string;
  adminToken: string;
}

export interface UpdateUserAttributesParams {
  userId: string;
  attributes: Record<string, string | string[]>;
  adminToken: string;
}

export interface SendVerifyEmailParams {
  userId: string;
  adminToken: string;
}

export interface KeycloakAdminClientInterface {
  getAdminToken(): Promise<GetAdminTokenResult>;
  updateUser(params: UpdateUserParams): Promise<void>;
  resetPassword(params: ResetPasswordParams): Promise<void>;
  toggleUserEnabled(params: ToggleUserEnabledParams): Promise<void>;
  deleteUser(params: DeleteUserParams): Promise<void>;
  updateUserAttributes(params: UpdateUserAttributesParams): Promise<void>;
  sendVerifyEmail(params: SendVerifyEmailParams): Promise<void>;
}

export class KeycloakAdminError extends Error {
  readonly statusCode?: number;
  readonly code?: string;
  readonly context?: Record<string, unknown>;
  constructor(params: {
    message: string;
    statusCode?: number;
    code?: string;
    context?: Record<string, unknown>;
  });
}

export class KeycloakAdminClient implements KeycloakAdminClientInterface {
  getAdminToken(): Promise<GetAdminTokenResult>;
  updateUser(params: UpdateUserParams): Promise<void>;
  resetPassword(params: ResetPasswordParams): Promise<void>;
  toggleUserEnabled(params: ToggleUserEnabledParams): Promise<void>;
  deleteUser(params: DeleteUserParams): Promise<void>;
  updateUserAttributes(params: UpdateUserAttributesParams): Promise<void>;
  sendVerifyEmail(params: SendVerifyEmailParams): Promise<void>;
}

export class KeycloakAdminModule {
  static forRoot(config: KeycloakAdminConfig): DynamicModule;
}

export function validateKeycloakAdminConfig(config: KeycloakAdminConfig): void;

export const KEYCLOAK_ADMIN_CLIENT = "KEYCLOAK_ADMIN_CLIENT";
export const KEYCLOAK_ADMIN_CONFIG = "KEYCLOAK_ADMIN_CONFIG";
export const KEYCLOAK_ADMIN_PROVIDER = "KEYCLOAK_ADMIN_PROVIDER";
