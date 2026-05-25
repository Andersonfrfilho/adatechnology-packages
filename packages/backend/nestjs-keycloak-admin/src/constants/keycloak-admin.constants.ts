import pkg from "../../package.json";

export const KEYCLOAK_ADMIN_LIB_NAME: string = pkg.name;
export const KEYCLOAK_ADMIN_LIB_VERSION: string = pkg.version;

export const KEYCLOAK_ADMIN_DEFAULT_TIMEOUT = 5000;
export const KEYCLOAK_ADMIN_GRANT_TYPE_PASSWORD = "password";
export const KEYCLOAK_ADMIN_CLIENT_ID_ADMIN_CLI = "admin-cli";
export const KEYCLOAK_ADMIN_CONTENT_TYPE_FORM =
  "application/x-www-form-urlencoded";
export const KEYCLOAK_ADMIN_CONTENT_TYPE_JSON = "application/json";
export const KEYCLOAK_ADMIN_AUTHORIZATION_HEADER = "Authorization";
export const KEYCLOAK_ADMIN_BEARER_PREFIX = "Bearer ";

export const KEYCLOAK_ADMIN_ENDPOINTS = {
  MASTER_TOKEN: "/realms/master/protocol/openid-connect/token",
  ADMIN_USERS: (baseUrl: string, realm: string, userId?: string) =>
    userId
      ? `${baseUrl}/admin/realms/${realm}/users/${userId}`
      : `${baseUrl}/admin/realms/${realm}/users`,
  ADMIN_RESET_PASSWORD: (baseUrl: string, realm: string, userId: string) =>
    `${baseUrl}/admin/realms/${realm}/users/${userId}/reset-password`,
  ADMIN_SEND_VERIFY_EMAIL: (baseUrl: string, realm: string, userId: string) =>
    `${baseUrl}/admin/realms/${realm}/users/${userId}/send-verify-email`,
} as const;

export const KEYCLOAK_ADMIN_ERROR_CODES = {
  ADMIN_TOKEN_ERROR: "KEYCLOAK_ADMIN_TOKEN_ERROR",
  CREATE_USER_ERROR: "KEYCLOAK_CREATE_USER_ERROR",
  UPDATE_USER_ERROR: "KEYCLOAK_UPDATE_USER_ERROR",
  RESET_PASSWORD_ERROR: "KEYCLOAK_RESET_PASSWORD_ERROR",
  TOGGLE_ENABLED_ERROR: "KEYCLOAK_TOGGLE_ENABLED_ERROR",
  DELETE_USER_ERROR: "KEYCLOAK_DELETE_USER_ERROR",
  UPDATE_ATTRIBUTES_ERROR: "KEYCLOAK_UPDATE_ATTRIBUTES_ERROR",
  SEND_VERIFY_EMAIL_ERROR: "KEYCLOAK_SEND_VERIFY_EMAIL_ERROR",
} as const;
