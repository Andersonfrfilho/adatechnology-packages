import { LIB_NAME, LIB_VERSION } from "../../http.constants";

export const HTTP_CLIENT_LABEL = `${LIB_NAME}@${LIB_VERSION}`;

export const HEADERS_PARAMS = {
  REQUEST_ID: "x-request-id",
  FALLBACKS: ["x-correlation-id"],
  NO_REQUEST_ID_LABEL: "no-request-id",
  AUTHORIZATION: "Authorization",
};
export const AUTH_SCHEME = {
  BEARER: "Bearer",
};

export const DEFAULTS = {
  CACHE_TTL: 300000, // 5 minutes
  STATUS_TEXT_OK: "OK",
};
export const LOG_TYPES = {
  REQUEST: "request",
  RESPONSE: "response",
  ERROR: "error",
} as const;

export const ANSI_COLORS = {
  ERROR: "\x1b[31m",
  WARN: "\x1b[33m",
  INFO: "\x1b[34m",
  RESET: "\x1b[0m",
};
