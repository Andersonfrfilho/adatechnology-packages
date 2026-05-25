import { HttpRequestConfig } from "../../../http.interface";

export interface UrlConfig {
  url: string;
  config?: HttpRequestConfig;
}

export interface UrlDataConfig {
  url: string;
  data?: unknown;
  config?: HttpRequestConfig;
}

export interface PerformGetParams {
  url: string;
  config?: HttpRequestConfig;
  cacheKey?: string;
}

export interface GenerateCacheKeyParams {
  url: string;
  config?: HttpRequestConfig;
}

export interface SetCacheParams<T> {
  key: string;
  data: T;
  ttl?: number;
}

export interface SetGlobalHeaderParams {
  key: string;
  value: string;
}

export interface SetAuthTokenParams {
  token: string;
  type?: string;
}
