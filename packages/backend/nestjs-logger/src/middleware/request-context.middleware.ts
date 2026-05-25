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
    const id = existing || (format === "uuid" ? randomUUID() : generateShortId());

    // Run the rest of the request inside the async local storage context
    asyncLocalStorage.run({ requestId: id }, () => next());
  }
}
