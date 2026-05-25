import type { ExtractedHttpError } from "../types/keycloak-admin.types";

export function extractHttpError(err: unknown): ExtractedHttpError {
  const unknownErr = err as Record<string, unknown> | undefined;
  const response = unknownErr?.response as Record<string, unknown> | undefined;
  const responseData = response?.data as Record<string, unknown> | undefined;

  let statusCode: number | undefined = undefined;
  if (typeof unknownErr?.status === "number") {
    statusCode = unknownErr.status;
  } else if (typeof response?.status === "number") {
    statusCode = response.status;
  }

  const details = responseData ?? unknownErr?.message;
  const rawError = responseData?.error ?? responseData?.errorMessage;
  const errorCode =
    typeof rawError === "string"
      ? rawError
      : typeof unknownErr?.code === "string"
        ? unknownErr.code
        : undefined;

  return { statusCode, details, errorCode };
}
