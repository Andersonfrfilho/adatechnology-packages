import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor, Optional } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { LOGGER_PROVIDER, LOGGER_CONFIG } from "../logger.token";
import type { LoggerProviderInterface } from "../logger.interface";
import type { LoggerConfig } from "../logger.config";
import { HTTP_LOGGING_INTERCEPTOR_CONTEXT } from "./http-logging.interceptor.constant";
import { EXCLUDE_HTTP_LOGGING_KEY } from "./exclude-http-logging.decorator";

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly excludedPaths: string[];

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
      return JSON.stringify(error);
    } catch {
      return "unknown error";
    }
  }

  constructor(
    @Inject(LOGGER_PROVIDER)
    private readonly logger: LoggerProviderInterface,
    private readonly reflector: Reflector,
    @Optional() @Inject(LOGGER_CONFIG)
    config?: LoggerConfig,
  ) {
    this.excludedPaths = config?.interceptorExcludedPaths ?? [];
  }

  private isExcluded(url: string): boolean {
    const normalized = url.replace(/^\/v\d+/, "");
    return this.excludedPaths.some(
      (path) => normalized === path || normalized.startsWith(path + "/"),
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Record<string, any>>();
    const response = http.getResponse<Record<string, any>>();
    const start = Date.now();

    const isDecoratorExcluded = this.reflector.getAllAndOverride<boolean>(
      EXCLUDE_HTTP_LOGGING_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isDecoratorExcluded || this.isExcluded(request.url)) {
      return next.handle();
    }

    const { method, url, headers, body, query, params } = request;

    this.logger.info({
      message: "HTTP Request",
      context: HTTP_LOGGING_INTERCEPTOR_CONTEXT.INTERCEPT,
      meta: {
        request: {
          method,
          path: url,
          headers,
          query: query && Object.keys(query).length ? query : undefined,
          params: params && Object.keys(params).length ? params : undefined,
          body: body && Object.keys(body).length ? body : undefined,
        },
      },
    });

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          const durationMs = Date.now() - start;
          const statusCode =
            response?.statusCode ??
            response?.raw?.statusCode ??
            200;

          this.logger.info({
            message: "HTTP Response",
            context: HTTP_LOGGING_INTERCEPTOR_CONTEXT.ON_RESPONSE,
            meta: {
              request: {
                method,
                path: url,
              },
              response: {
                statusCode,
                durationMs,
                body: responseBody ?? undefined,
              },
            },
          });
        },
        error: (error: unknown) => {
          const durationMs = Date.now() - start;

          this.logger.error({
            message: "HTTP Response Error",
            context: HTTP_LOGGING_INTERCEPTOR_CONTEXT.ON_ERROR,
            meta: {
              request: {
                method,
                path: url,
              },
              response: {
                durationMs,
                error: this.toErrorMessage(error),
              },
            },
          });
        },
      }),
    );
  }
}
