import { Injectable } from "@nestjs/common";
import { BaseAppError } from "./base-app-error";
import type { ErrorContext, BaseAppErrorParams } from "./errors.interfaces";
import {
  SHARED_ERRORS,
  SHARED_ERROR_MESSAGES,
  SHARED_INTERNAL_FRAME_RE,
} from "./errors.constants";

@Injectable()
export class ErrorMapperService {
  /**
   * Map an upstream/internal error to a BaseAppError with normalized fields.
   * Keeps a small context to help tracing origin without leaking secrets.
   */
  mapUpstreamError(err: unknown): BaseAppError {
    // If it's already a BaseAppError, return as-is
    if (err instanceof BaseAppError) return err;

    try {
      // Treat incoming error as an unknown object and narrow properties safely
      const obj = (err as Record<string, unknown> | undefined) ?? undefined;

      const context: ErrorContext = {};

      // attach parsed stack frames to context for tracing origin
      if (obj && typeof obj.stack === "string") {
        const frames = this.parseStack(obj.stack);
        if (frames.length) {
          context.stack = frames as unknown as ErrorContext["stack"];
          // first non-internal frame as origin
          const origin = frames.find((f) => !this.isInternalFrame(f.file));
          if (origin)
            context.origin = origin as unknown as ErrorContext["origin"];
        }
      }

      if (obj && typeof obj.config === "object" && obj.config !== null) {
        const cfg = obj.config as Record<string, unknown>;
        context.url =
          typeof cfg.url === "string"
            ? (cfg.url as string)
            : typeof cfg.baseURL === "string"
              ? (cfg.baseURL as string)
              : undefined;
        context.method =
          typeof cfg.method === "string" ? (cfg.method as string) : undefined;
      }

      if (obj && typeof obj.response === "object" && obj.response !== null) {
        const resp = obj.response as Record<string, unknown>;
        const status =
          typeof resp.status === "number"
            ? (resp.status as number)
            : SHARED_ERRORS.DEFAULT_STATUS;
        const data = resp.data as Record<string, unknown> | undefined;
        const message =
          data && typeof data.message === "string"
            ? (data.message as string)
            : typeof obj.message === "string"
              ? (obj.message as string)
              : SHARED_ERROR_MESSAGES.UPSTREAM_ERROR;
        const code =
          typeof obj.code === "string" ? (obj.code as string) : undefined;
        return new BaseAppError({
          message,
          status,
          code,
          context,
        } as BaseAppErrorParams);
      }

      if (obj && typeof obj.request === "object") {
        // no response received
        const code =
          typeof obj.code === "string" ? (obj.code as string) : undefined;
        return new BaseAppError({
          message: SHARED_ERROR_MESSAGES.NO_RESPONSE,
          status: SHARED_ERRORS.DEFAULT_STATUS,
          code,
          context,
        } as BaseAppErrorParams);
      }

      // Fallback generic error
      return new BaseAppError({
        message:
          obj && typeof obj.message === "string"
            ? (obj.message as string)
            : SHARED_ERROR_MESSAGES.UNEXPECTED_ERROR,
        status: SHARED_ERRORS.INTERNAL_STATUS,
        code: typeof obj?.code === "string" ? (obj.code as string) : undefined,
        context,
      } as BaseAppErrorParams);
    } catch (e) {
      return new BaseAppError({
        message: SHARED_ERROR_MESSAGES.MAPPING_FAILURE,
        status: SHARED_ERRORS.INTERNAL_STATUS,
        context: { original: String(err) },
      } as BaseAppErrorParams);
    }
  }

  private parseStack(
    stack: string,
  ): Array<{ fn?: string; file?: string; line?: number; column?: number }> {
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
        const lineNum = parseInt(m[3], 10);
        const colNum = parseInt(m[4], 10);
        frames.push({ fn, file, line: lineNum, column: colNum });
      }
    }
    return frames;
  }

  private isInternalFrame(file?: string): boolean {
    if (!file) return false;
    return SHARED_INTERNAL_FRAME_RE.test(file);
  }
}
