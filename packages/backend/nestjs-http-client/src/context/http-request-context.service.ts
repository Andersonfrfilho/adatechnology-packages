import { AsyncLocalStorage } from "async_hooks";
import { HttpRequestContext } from "./http-request-context.interface";

const httpRequestContextStorage = new AsyncLocalStorage<HttpRequestContext>();

export function getHttpRequestContext(): HttpRequestContext | undefined {
  return httpRequestContextStorage.getStore();
}

export function runWithHttpRequestContext<T>(
  ctx: HttpRequestContext,
  fn: () => T,
): T {
  return httpRequestContextStorage.run(ctx, fn);
}
