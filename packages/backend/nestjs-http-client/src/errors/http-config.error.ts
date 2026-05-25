import { BaseAppError } from "./base-app-error";
import type { BaseAppErrorParams } from "./errors.interfaces";
import { HTTP_ERRORS, HTTP_SERVICE_NAME } from "./errors.constants";

export class HttpConfigError extends BaseAppError<Record<string, unknown>> {
  constructor(params: {
    message: string;
    status?: number;
    code?: string;
    context?: Record<string, unknown>;
  }) {
    const p: BaseAppErrorParams<Record<string, unknown>> = {
      message: params.message,
      status: params.status ?? HTTP_ERRORS.INTERNAL_STATUS,
      code: params.code,
      context: { service: HTTP_SERVICE_NAME, ...params.context },
    };
    super(p);
  }
}
