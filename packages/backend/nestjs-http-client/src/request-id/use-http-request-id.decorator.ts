import { applyDecorators, SetMetadata, UseInterceptors } from "@nestjs/common";

import { HTTP_REQUEST_ID_METADATA } from "./http-request-id.constants";
import { HttpRequestIdInterceptor } from "./http-request-id.interceptor";
import { HttpRequestIdOptions } from "./http-request-id.types";

export function UseHttpRequestId(options?: HttpRequestIdOptions) {
  return applyDecorators(
    SetMetadata(HTTP_REQUEST_ID_METADATA, options || {}),
    UseInterceptors(HttpRequestIdInterceptor),
  );
}
