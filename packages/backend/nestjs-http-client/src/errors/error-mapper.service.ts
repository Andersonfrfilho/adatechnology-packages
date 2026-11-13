import {
  HTTP_ERRORS,
  HTTP_ERROR_MESSAGES,
  INTERNAL_FRAME_RE,
} from "./errors.constants";
import type { ErrorContext } from "./errors.interfaces";

export class ErrorMapperService {
  private toSafeString(value: unknown): string {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.message;
    try {
      return JSON.stringify(value);
    } catch {
      return "unknown error";
    }
  }

  private isAlreadyMapped(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const candidate = err as Record<string, unknown>;
    return candidate.status !== undefined && candidate.message !== undefined;
  }

  private buildContext(obj: Record<string, unknown>): ErrorContext {
    const context: ErrorContext = {};

    if (obj?.config && typeof obj.config === "object") {
      const cfg = obj.config as Record<string, unknown>;
      context.url =
        (typeof cfg.url === "string" ? cfg.url : undefined) ||
        (typeof cfg.baseURL === "string" ? cfg.baseURL : undefined);
      context.method = typeof cfg.method === "string" ? cfg.method : undefined;
    }

    if (obj?.stack && typeof obj.stack === "string") {
      const frames = this.parseStack(obj.stack);
      if (frames.length) {
        context.stack = frames as unknown as ErrorContext["stack"];
        const origin = frames.find((f) => !this.isInternalFrame(f.file));
        if (origin) {
          context.origin = origin as unknown as ErrorContext["origin"];
        }
      }
    }

    return context;
  }

  private mapFromResponse(
    obj: Record<string, unknown>,
    context: ErrorContext,
  ): {
    message: unknown;
    status: number;
    code: string | undefined;
    context: ErrorContext;
  } | null {
    if (!obj?.response || typeof obj.response !== "object") {
      return null;
    }

    const resp = obj.response as Record<string, unknown>;
    const status =
      typeof resp.status === "number"
        ? resp.status
        : HTTP_ERRORS.DEFAULT_STATUS;

    const message =
      (resp.data && (resp.data as Record<string, unknown>).message) ||
      obj.message ||
      HTTP_ERROR_MESSAGES.UPSTREAM_ERROR;

    return {
      message,
      status,
      code: typeof obj.code === "string" ? obj.code : undefined,
      context: {
        ...context,
        data: resp.data,
      },
    };
  }

  mapUpstreamError(err: unknown) {
    if (this.isAlreadyMapped(err)) {
      return err;
    }

    try {
      const obj = (err as Record<string, unknown>) ?? {};
      const context = this.buildContext(obj);

      const mappedResponse = this.mapFromResponse(obj, context);
      if (mappedResponse) return mappedResponse;

      if (obj?.request) {
        return {
          message: HTTP_ERROR_MESSAGES.NO_RESPONSE,
          status: HTTP_ERRORS.DEFAULT_STATUS,
          code: typeof obj.code === "string" ? obj.code : undefined,
          context,
        };
      }

      return {
        message: obj?.message || HTTP_ERROR_MESSAGES.UNEXPECTED_ERROR,
        status: HTTP_ERRORS.INTERNAL_STATUS,
        code: typeof obj.code === "string" ? obj.code : undefined,
        context,
      };
    } catch {
      return {
        message: HTTP_ERROR_MESSAGES.MAPPING_FAILURE,
        status: HTTP_ERRORS.INTERNAL_STATUS,
        code: undefined,
        context: { original: this.toSafeString(err) },
      };
    }
  }

  private parseStack(stack: string) {
    const lines = stack
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const frames: Array<{
      fn?: string;
      file?: string;
      line?: number;
      column?: number;
    }> = [];
    const re = /^at\s+(?:(.*?)\s+\()?(.*?):(\d+):(\d+)\)?$/;
    for (const line of lines) {
      const m = re.exec(line);
      if (m) {
        const fn = m[1] || undefined;
        const file = m[2];
        const lineNum = Number.parseInt(m[3], 10);
        const colNum = Number.parseInt(m[4], 10);
        frames.push({ fn, file, line: lineNum, column: colNum });
      }
    }
    return frames;
  }

  private isInternalFrame(file?: string) {
    if (!file) return false;
    return INTERNAL_FRAME_RE.test(file);
  }
}
