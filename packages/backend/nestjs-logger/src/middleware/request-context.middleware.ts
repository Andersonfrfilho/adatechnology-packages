import { Inject, Injectable, NestMiddleware, Optional } from "@nestjs/common";
import { randomBytes, randomUUID } from "crypto";
import { asyncLocalStorage } from "../context/async-context.service";
import { HEADERS_PARAMS } from "../request-id.constants";
import { LOGGER_CONFIG } from "../logger.token";
import type { LoggerConfig } from "../logger.config";
import type {
  RequestLike,
  ResponseLike,
  NextFunctionLike,
} from "./request-context.types";

/**
 * Gera um ID curto de 12 chars hex (ex: a1b2c3d4e5f6).
 * Mesmo formato do short-hash do git — legível em logs Loki e correlacionável com Jaeger.
 */
function generateShortId(): string {
  return randomBytes(6).toString("hex"); // 6 bytes = 12 hex chars
}

/**
 * Extrai traceId do header W3C traceparent (formato: 00-traceId-spanId-flags).
 * Se inválido, retorna undefined.
 */
function extractTraceIdFromTraceparent(traceparent?: string): string | undefined {
  if (!traceparent) return undefined;
  const parts = traceparent.split("-");
  if (parts.length !== 4 || parts[0] !== "00") return undefined;
  return parts[1]; // retorna 32 chars hex traceId
}

/**
 * Gera W3C traceparent header.
 * Formato: 00-{traceId}-{spanId}-01
 */
function generateW3cTraceparent(traceId: string): string {
  const spanId = randomBytes(8).toString("hex"); // 16 hex chars
  return `00-${traceId}-${spanId}-01`;
}

/**
 * Converte requestId (12 ou 36 chars) para 32-char traceId para W3C format.
 * 12 chars → preenche com zeros à esquerda para 32 chars.
 * 36 chars (UUID com hífens) → remove hífens.
 */
function normalizeToTraceId(id: string): string {
  if (id.length === 36) {
    // UUID with hyphens → remove them (00000000-0000-0000-0000-000000000000 → 32 chars)
    return id.replace(/-/g, "");
  }
  if (id.length === 12) {
    // 12-char hex → pad to 32 chars with leading zeros
    return id.padStart(32, "0");
  }
  // Already 32 chars, return as-is
  return id;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    @Optional() @Inject(LOGGER_CONFIG) private readonly config?: LoggerConfig,
  ) {}

  use(req: RequestLike, _res: ResponseLike, next: NextFunctionLike) {
    const existing =
      (req.headers?.[HEADERS_PARAMS.REQUEST_ID] as string) ||
      (req.headers?.[HEADERS_PARAMS.FALLBACKS[0]] as string);

    const format = this.config?.requestIdFormat ?? "short-hash";
    let id = existing || (format === "uuid" ? randomUUID() : generateShortId());

    // Normalize requestId to remove hyphens from UUID format for cleaner logs
    if (id.length === 36 && id.includes("-")) {
      id = id.replace(/-/g, "");
    }

    // Extract or generate traceparent (W3C format)
    const incomingTraceparent = req.headers?.["traceparent"] as string | undefined;
    const traceId =
      extractTraceIdFromTraceparent(incomingTraceparent) ||
      normalizeToTraceId(id);
    const traceparent = generateW3cTraceparent(traceId);

    // Run the rest of the request inside the async local storage context
    asyncLocalStorage.run({ requestId: id, traceparent, traceId }, () => next());
  }
}
