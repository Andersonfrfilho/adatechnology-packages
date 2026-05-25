import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import { asyncLocalStorage } from "../context/async-context.service";
import { HEADERS_PARAMS } from "../request-id.constants";
import { ID_FALLBACK_SEPARATOR } from "../logger.constant";
import type {
  RequestLike,
  ResponseLike,
  NextFunctionLike,
} from "./request-context.types";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestLike, _res: ResponseLike, next: NextFunctionLike) {
    const existing =
      (req.headers?.[HEADERS_PARAMS.REQUEST_ID] as string) ||
      (req.headers?.[HEADERS_PARAMS.FALLBACKS[0]] as string);
    const id =
      existing ||
      (typeof randomUUID === "function"
        ? randomUUID()
        : `${Date.now()}${ID_FALLBACK_SEPARATOR}${Math.random()}`);
    // Run the rest of the request inside the async local storage context
    asyncLocalStorage.run({ requestId: id }, () => next());
  }
}
