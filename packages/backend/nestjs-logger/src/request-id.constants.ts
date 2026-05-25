export const DEFAULT_HTTP_REQUEST_ID_HEADER = "x-request-id";
export const DEFAULT_HTTP_REQUEST_ID_FALLBACKS = ["x-correlation-id"];

export const HEADERS_PARAMS = {
	REQUEST_ID: DEFAULT_HTTP_REQUEST_ID_HEADER,
	FALLBACKS: DEFAULT_HTTP_REQUEST_ID_FALLBACKS,
};

/**
 * Formatos disponíveis para o requestId gerado pelo RequestContextMiddleware.
 *
 * @example
 * import { REQUEST_ID_FORMAT } from '@adatechnology/nestjs-logger';
 *
 * LoggerModule.forRoot({ requestIdFormat: REQUEST_ID_FORMAT.SHORT_HASH })
 */
export const REQUEST_ID_FORMAT = {
  /** 12 chars hex (ex: a1b2c3d4e5f6) — compacto, legível em Loki, correlacionável com Jaeger */
  SHORT_HASH: "short-hash" as const,
  /** UUID v4 completo (ex: 550e8400-e29b-41d4-a716-446655440000) */
  UUID: "uuid" as const,
} as const;

export type RequestIdFormat = (typeof REQUEST_ID_FORMAT)[keyof typeof REQUEST_ID_FORMAT];
