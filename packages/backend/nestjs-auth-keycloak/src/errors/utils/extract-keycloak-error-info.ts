import { NETWORK_ERROR_PREFIX } from "../constants/keycloak-error.constants";
import type { ExtractedKeycloakErrorInfo } from "../types/keycloak-error.types";

export function extractKeycloakErrorInfo(
  err: unknown,
): ExtractedKeycloakErrorInfo {
  const unknownErr = err as Record<string, unknown> | undefined;
  const response = unknownErr?.response as Record<string, unknown> | undefined;
  const responseData = response?.data as Record<string, unknown> | undefined;
  const context = unknownErr?.context as Record<string, unknown> | undefined;

  let statusCode: number | undefined = undefined;
  if (typeof unknownErr?.status === "number") {
    statusCode = unknownErr.status;
  } else if (typeof response?.status === "number") {
    statusCode = response.status;
  }

  const details =
    responseData ?? context?.data ?? context ?? unknownErr?.details;
  const errorCode = unknownErr?.code ?? responseData?.error;

  let keycloakError: string | undefined = undefined;

  if (details && typeof details === "object") {
    const raw = (details as Record<string, unknown>).error;
    if (typeof raw === "string") {
      keycloakError = raw;
    } else if (raw !== undefined && raw !== null) {
      try {
        keycloakError = JSON.stringify(raw);
      } catch {
        keycloakError = "unknown_error_payload";
      }
    }
  }

  let normalizedErrorCode: string | undefined = undefined;
  if (typeof errorCode === "string") {
    normalizedErrorCode = errorCode;
  } else if (typeof errorCode === "number" || typeof errorCode === "boolean") {
    normalizedErrorCode = String(errorCode);
  }

  return {
    statusCode,
    details: details ?? unknownErr?.message,
    keycloakError:
      keycloakError ??
      (normalizedErrorCode
        ? `${NETWORK_ERROR_PREFIX}${normalizedErrorCode}`
        : undefined),
  };
}
