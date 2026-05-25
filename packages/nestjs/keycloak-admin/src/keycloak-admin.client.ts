import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  HTTP_PROVIDER,
  type HttpProviderInterface,
} from "@adatechnology/http-client";
import {
  LOGGER_PROVIDER,
  type LoggerProviderInterface,
} from "@adatechnology/logger";
import { KeycloakAdminError } from "./errors/keycloak-admin.error";

import type {
  KeycloakAdminClientInterface,
  KeycloakAdminConfig,
  GetAdminTokenResult,
  CreateUserParams,
  UpdateUserParams,
  ResetPasswordParams,
  ToggleUserEnabledParams,
  DeleteUserParams,
  UpdateUserAttributesParams,
  SendVerifyEmailParams,
} from "./keycloak-admin.interface";
import { KEYCLOAK_ADMIN_CONFIG } from "./keycloak-admin.token";
import {
  KEYCLOAK_ADMIN_GRANT_TYPE_PASSWORD,
  KEYCLOAK_ADMIN_CLIENT_ID_ADMIN_CLI,
  KEYCLOAK_ADMIN_CONTENT_TYPE_FORM,
  KEYCLOAK_ADMIN_CONTENT_TYPE_JSON,
  KEYCLOAK_ADMIN_AUTHORIZATION_HEADER,
  KEYCLOAK_ADMIN_BEARER_PREFIX,
  KEYCLOAK_ADMIN_ENDPOINTS,
  KEYCLOAK_ADMIN_ERROR_CODES,
  KEYCLOAK_ADMIN_LIB_NAME,
  KEYCLOAK_ADMIN_LIB_VERSION,
} from "./constants/keycloak-admin.constants";
import type { KeycloakRawTokenResponse } from "./types/keycloak-admin.types";
import { extractHttpError } from "./utils/extract-http-error";

@Injectable()
export class KeycloakAdminClient implements KeycloakAdminClientInterface {
  private readonly className = this.constructor.name;

  constructor(
    @Inject(KEYCLOAK_ADMIN_CONFIG)
    private readonly config: KeycloakAdminConfig,
    @Inject(HTTP_PROVIDER)
    private readonly httpProvider: HttpProviderInterface,
    @Optional()
    @Inject(LOGGER_PROVIDER)
    private readonly logger?: LoggerProviderInterface,
  ) {}

  private log(
    level: "info" | "warn" | "error",
    message: string,
    libMethod: string,
    meta?: Record<string, unknown>,
  ) {
    if (!this.logger) return;

    const payload = {
      message,
      context: this.className,
      lib: KEYCLOAK_ADMIN_LIB_NAME,
      libVersion: KEYCLOAK_ADMIN_LIB_VERSION,
      libMethod,
      meta,
    };

    if (level === "info") this.logger.info(payload);
    else if (level === "warn") this.logger.warn(payload);
    else if (level === "error") this.logger.error(payload);
  }

  async getAdminToken(): Promise<GetAdminTokenResult> {
    const method = "getAdminToken";
    this.log("info", `${method} - Start`, method, { realm: this.config.realm });

    const url = `${this.config.baseUrl}${KEYCLOAK_ADMIN_ENDPOINTS.MASTER_TOKEN}`;
    const body = new URLSearchParams();
    body.append("grant_type", KEYCLOAK_ADMIN_GRANT_TYPE_PASSWORD);
    body.append("client_id", KEYCLOAK_ADMIN_CLIENT_ID_ADMIN_CLI);
    body.append("username", this.config.adminUser);
    body.append("password", this.config.adminPassword);

    try {
      const response = await this.httpProvider.post<KeycloakRawTokenResponse>({
        url,
        data: body,
        config: {
          headers: { "Content-Type": KEYCLOAK_ADMIN_CONTENT_TYPE_FORM },
        },
      });

      const result: GetAdminTokenResult = {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type,
      };

      this.log("info", `${method} - Success`, method);
      return result;
    } catch (err: unknown) {
      const { statusCode, details, errorCode } = extractHttpError(err);
      this.log("error", `${method} - Failed`, method, {
        statusCode,
        errorCode,
      });

      throw new KeycloakAdminError({
        message: "Keycloak admin token request failed",
        statusCode: statusCode ?? 502,
        code: KEYCLOAK_ADMIN_ERROR_CODES.ADMIN_TOKEN_ERROR,
        context: {
          url,
          method: "POST",
          details,
          errorCode,
        },
      });
    }
  }

  async createUser(params: CreateUserParams): Promise<string> {
    const method = "createUser";
    const {
      username,
      email,
      firstName,
      lastName,
      enabled,
      emailVerified,
      credentials,
      attributes,
      adminToken,
    } = params;
    this.log("info", `${method} - Start`, method, { username, email });

    const url = KEYCLOAK_ADMIN_ENDPOINTS.ADMIN_USERS(
      this.config.baseUrl,
      this.config.realm,
    );

    const userData: Record<string, unknown> = {
      username,
      email,
      firstName,
      lastName,
      enabled,
      emailVerified,
      ...(credentials ? { credentials } : {}),
      ...(attributes ? { attributes } : {}),
    };

    try {
      const response = await this.httpProvider.post({
        url,
        data: userData,
        config: {
          headers: {
            [KEYCLOAK_ADMIN_AUTHORIZATION_HEADER]: `${KEYCLOAK_ADMIN_BEARER_PREFIX}${adminToken}`,
            "Content-Type": KEYCLOAK_ADMIN_CONTENT_TYPE_JSON,
          },
        },
      });

      // Keycloak returns the user ID in the Location header
      const locationHeader =
        response.headers?.["location"] ?? response.headers?.["Location"];
      const userId =
        typeof locationHeader === "string"
          ? (locationHeader.split("/").pop() ?? "")
          : "";

      this.log("info", `${method} - Success`, method, {
        username,
        email,
        userId,
      });
      return userId;
    } catch (err: unknown) {
      const { statusCode, details, errorCode } = extractHttpError(err);
      this.log("error", `${method} - Failed`, method, {
        username,
        email,
        statusCode,
        errorCode,
      });

      throw new KeycloakAdminError({
        message: "Keycloak create user failed",
        statusCode: statusCode ?? 502,
        code: KEYCLOAK_ADMIN_ERROR_CODES.CREATE_USER_ERROR,
        context: { url, method: "POST", username, email, details, errorCode },
      });
    }
  }

  async updateUser(params: UpdateUserParams): Promise<void> {
    const method = "updateUser";
    const { userId, userData, adminToken } = params;
    this.log("info", `${method} - Start`, method, { userId });

    const url = KEYCLOAK_ADMIN_ENDPOINTS.ADMIN_USERS(
      this.config.baseUrl,
      this.config.realm,
      userId,
    );

    try {
      await this.httpProvider.put({
        url,
        data: userData,
        config: {
          headers: {
            [KEYCLOAK_ADMIN_AUTHORIZATION_HEADER]: `${KEYCLOAK_ADMIN_BEARER_PREFIX}${adminToken}`,
            "Content-Type": KEYCLOAK_ADMIN_CONTENT_TYPE_JSON,
          },
        },
      });

      this.log("info", `${method} - Success`, method, { userId });
    } catch (err: unknown) {
      const { statusCode, details, errorCode } = extractHttpError(err);
      this.log("error", `${method} - Failed`, method, {
        userId,
        statusCode,
        errorCode,
      });

      throw new KeycloakAdminError({
        message: "Keycloak update user failed",
        statusCode: statusCode ?? 502,
        code: KEYCLOAK_ADMIN_ERROR_CODES.UPDATE_USER_ERROR,
        context: { url, method: "PUT", userId, details, errorCode },
      });
    }
  }

  async resetPassword(params: ResetPasswordParams): Promise<void> {
    const method = "resetPassword";
    const { userId, password, temporary, adminToken } = params;
    this.log("info", `${method} - Start`, method, { userId, temporary });

    const url = KEYCLOAK_ADMIN_ENDPOINTS.ADMIN_RESET_PASSWORD(
      this.config.baseUrl,
      this.config.realm,
      userId,
    );

    try {
      await this.httpProvider.put({
        url,
        data: { type: "password", value: password, temporary },
        config: {
          headers: {
            [KEYCLOAK_ADMIN_AUTHORIZATION_HEADER]: `${KEYCLOAK_ADMIN_BEARER_PREFIX}${adminToken}`,
            "Content-Type": KEYCLOAK_ADMIN_CONTENT_TYPE_JSON,
          },
        },
      });

      this.log("info", `${method} - Success`, method, { userId });
    } catch (err: unknown) {
      const { statusCode, details, errorCode } = extractHttpError(err);
      this.log("error", `${method} - Failed`, method, {
        userId,
        statusCode,
        errorCode,
      });

      throw new KeycloakAdminError({
        message: "Keycloak reset password failed",
        statusCode: statusCode ?? 502,
        code: KEYCLOAK_ADMIN_ERROR_CODES.RESET_PASSWORD_ERROR,
        context: { url, method: "PUT", userId, details, errorCode },
      });
    }
  }

  async toggleUserEnabled(params: ToggleUserEnabledParams): Promise<void> {
    const method = "toggleUserEnabled";
    const { userId, enabled, adminToken } = params;
    this.log("info", `${method} - Start`, method, { userId, enabled });

    const url = KEYCLOAK_ADMIN_ENDPOINTS.ADMIN_USERS(
      this.config.baseUrl,
      this.config.realm,
      userId,
    );

    try {
      await this.httpProvider.put({
        url,
        data: { enabled },
        config: {
          headers: {
            [KEYCLOAK_ADMIN_AUTHORIZATION_HEADER]: `${KEYCLOAK_ADMIN_BEARER_PREFIX}${adminToken}`,
            "Content-Type": KEYCLOAK_ADMIN_CONTENT_TYPE_JSON,
          },
        },
      });

      this.log("info", `${method} - Success`, method, { userId, enabled });
    } catch (err: unknown) {
      const { statusCode, details, errorCode } = extractHttpError(err);
      this.log("error", `${method} - Failed`, method, {
        userId,
        enabled,
        statusCode,
        errorCode,
      });

      throw new KeycloakAdminError({
        message: "Keycloak toggle user enabled failed",
        statusCode: statusCode ?? 502,
        code: KEYCLOAK_ADMIN_ERROR_CODES.TOGGLE_ENABLED_ERROR,
        context: { url, method: "PUT", userId, enabled, details, errorCode },
      });
    }
  }

  async deleteUser(params: DeleteUserParams): Promise<void> {
    const method = "deleteUser";
    const { userId, adminToken } = params;
    this.log("info", `${method} - Start`, method, { userId });

    const url = KEYCLOAK_ADMIN_ENDPOINTS.ADMIN_USERS(
      this.config.baseUrl,
      this.config.realm,
      userId,
    );

    try {
      await this.httpProvider.delete({
        url,
        config: {
          headers: {
            [KEYCLOAK_ADMIN_AUTHORIZATION_HEADER]: `${KEYCLOAK_ADMIN_BEARER_PREFIX}${adminToken}`,
          },
        },
      });

      this.log("info", `${method} - Success`, method, { userId });
    } catch (err: unknown) {
      const { statusCode, details, errorCode } = extractHttpError(err);
      this.log("error", `${method} - Failed`, method, {
        userId,
        statusCode,
        errorCode,
      });

      throw new KeycloakAdminError({
        message: "Keycloak delete user failed",
        statusCode: statusCode ?? 502,
        code: KEYCLOAK_ADMIN_ERROR_CODES.DELETE_USER_ERROR,
        context: { url, method: "DELETE", userId, details, errorCode },
      });
    }
  }

  async updateUserAttributes(
    params: UpdateUserAttributesParams,
  ): Promise<void> {
    const method = "updateUserAttributes";
    const { userId, attributes, adminToken } = params;
    this.log("info", `${method} - Start`, method, {
      userId,
      attributeKeys: Object.keys(attributes),
    });

    const url = KEYCLOAK_ADMIN_ENDPOINTS.ADMIN_USERS(
      this.config.baseUrl,
      this.config.realm,
      userId,
    );

    try {
      await this.httpProvider.put({
        url,
        data: { attributes },
        config: {
          headers: {
            [KEYCLOAK_ADMIN_AUTHORIZATION_HEADER]: `${KEYCLOAK_ADMIN_BEARER_PREFIX}${adminToken}`,
            "Content-Type": KEYCLOAK_ADMIN_CONTENT_TYPE_JSON,
          },
        },
      });

      this.log("info", `${method} - Success`, method, { userId });
    } catch (err: unknown) {
      const { statusCode, details, errorCode } = extractHttpError(err);
      this.log("error", `${method} - Failed`, method, {
        userId,
        statusCode,
        errorCode,
      });

      throw new KeycloakAdminError({
        message: "Keycloak update user attributes failed",
        statusCode: statusCode ?? 502,
        code: KEYCLOAK_ADMIN_ERROR_CODES.UPDATE_ATTRIBUTES_ERROR,
        context: { url, method: "PUT", userId, details, errorCode },
      });
    }
  }

  async sendVerifyEmail(params: SendVerifyEmailParams): Promise<void> {
    const method = "sendVerifyEmail";
    const { userId, adminToken } = params;
    this.log("info", `${method} - Start`, method, { userId });

    const url = KEYCLOAK_ADMIN_ENDPOINTS.ADMIN_SEND_VERIFY_EMAIL(
      this.config.baseUrl,
      this.config.realm,
      userId,
    );

    try {
      await this.httpProvider.put({
        url,
        data: {},
        config: {
          headers: {
            [KEYCLOAK_ADMIN_AUTHORIZATION_HEADER]: `${KEYCLOAK_ADMIN_BEARER_PREFIX}${adminToken}`,
            "Content-Type": KEYCLOAK_ADMIN_CONTENT_TYPE_JSON,
          },
        },
      });

      this.log("info", `${method} - Success`, method, { userId });
    } catch (err: unknown) {
      const { statusCode, details, errorCode } = extractHttpError(err);
      this.log("error", `${method} - Failed`, method, {
        userId,
        statusCode,
        errorCode,
      });

      throw new KeycloakAdminError({
        message: "Keycloak send verify email failed",
        statusCode: statusCode ?? 502,
        code: KEYCLOAK_ADMIN_ERROR_CODES.SEND_VERIFY_EMAIL_ERROR,
        context: { url, method: "PUT", userId, details, errorCode },
      });
    }
  }
}
