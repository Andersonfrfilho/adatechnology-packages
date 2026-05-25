import { BaseAppError } from "./base-app-error";
import type { BaseAppErrorParams } from "./errors.interfaces";
import { HTTP_ERRORS, HTTP_SERVICE_NAME } from "./errors.constants";

export class HttpClientError extends BaseAppError<Record<string, unknown>> {
  private static normalizeMessage(message: unknown): string {
    if (typeof message === "string") return message;
    if (message instanceof Error) return message.message;
    try {
      return JSON.stringify(message);
    } catch {
      return "HTTP client error";
    }
  }

  constructor(params: {
    message: unknown;
    status?: number;
    code?: string;
    context?: Record<string, unknown>;
  }) {
    const p: BaseAppErrorParams<Record<string, unknown>> = {
      message: HttpClientError.normalizeMessage(params.message),
      status: params.status ?? HTTP_ERRORS.DEFAULT_STATUS,
      code: params.code,
      context: { service: HTTP_SERVICE_NAME, ...params.context },
    };
    super(p);
  }
}
