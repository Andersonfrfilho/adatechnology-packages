import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { randomUUID } from "node:crypto";
import { from, Observable } from "rxjs";

import {
  ErrorInterceptor,
  HttpLoggingConfig,
  HttpLogType,
  HttpRequestLogContext,
  HttpRequestConfig,
  HttpResponse,
  HttpMethod,
} from "../../http.interface";
import { getHttpRequestContext } from "../../context/http-request-context.service";
import { ErrorMapperService } from "../../errors/error-mapper.service";
import { HttpClientError } from "../../errors/http-client-error";

import { AxiosHttpProviderInterface } from "./axios.http.interfaces";
import type { AxiosHttpProviderOptions } from "./types/axios.http.types";
import {
  UrlConfig,
  UrlDataConfig,
  PerformGetParams,
  GenerateCacheKeyParams,
  SetCacheParams,
  SetGlobalHeaderParams,
  SetAuthTokenParams,
} from "./types/axios.http.params";
import {
  HEADERS_PARAMS,
  LOG_TYPES,
  AUTH_SCHEME,
  DEFAULTS,
} from "./axios.http.constants";
import { LIB_NAME, LIB_VERSION } from "../../http.constants";

/** constants, interfaces and types are moved to dedicated files */

import { Inject, Injectable, Optional } from "@nestjs/common";
import { CACHE_PROVIDER, CacheProviderInterface } from "@adatechnology/nestjs-cache";
import {
  getContext,
  LOGGER_PROVIDER,
  LoggerProviderInterface,
  runWithContext,
} from "@adatechnology/nestjs-logger";

/**
 * Axios-based implementation of the HTTP provider interface.
 * Provides HTTP client functionality with both Promise and Observable APIs,
 * plus externalized caching capabilities.
 */
@Injectable()
export class AxiosHttpProvider implements AxiosHttpProviderInterface {
  private readonly axiosInstance: AxiosInstance;
  private readonly errorInterceptors: Map<number, ErrorInterceptor> = new Map();
  private nextErrorInterceptorId = 0;
  private readonly requestInterceptorIds: Set<number> = new Set();
  private readonly responseInterceptorIds: Set<number> = new Set();
  private readonly loggingConfig?: HttpLoggingConfig;
  private readonly defaultCacheTtl: number;
  private readonly cacheKeyPrefix: string;

  constructor(
    @Optional() axiosInstance?: AxiosInstance,
    @Optional() options?: AxiosHttpProviderOptions,
    @Optional()
    @Inject(CACHE_PROVIDER)
    private readonly cacheProvider?: CacheProviderInterface,
    @Optional()
    @Inject(LOGGER_PROVIDER)
    private readonly logger?: LoggerProviderInterface,
  ) {
    this.axiosInstance = axiosInstance || axios.create();
    this.loggingConfig = options?.logging;
    this.defaultCacheTtl = options?.cache?.defaultTtl ?? DEFAULTS.CACHE_TTL;
    this.cacheKeyPrefix = options?.cache?.keyPrefix ?? "";

    this.setupHttpLoggingInterceptors();
  }

  private setupHttpLoggingInterceptors(): void {
    if (!this.isLoggingEnabled()) {
      return;
    }

    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        (config as unknown as Record<string, unknown>).__httpStartedAt =
          Date.now();

        // Inject W3C traceparent header for distributed tracing
        const asyncCtx = getContext();
        const traceparent = asyncCtx?.traceparent as string | undefined;
        if (traceparent) {
          this.setHeaderValue({
            config,
            headerName: "traceparent",
            value: traceparent,
          });
        }

        if (this.shouldLogType(LOG_TYPES.REQUEST)) {
          const logContext = this.extractLogContext(config);
          const method = (config.method || HttpMethod.GET).toLowerCase();

          this.emitLog(
            LOG_TYPES.REQUEST,
            {
              method: method.toUpperCase(),
              url: this.resolveRequestUrl(config),
              source: this.buildSource(logContext),
              requestId: logContext.requestId,
              headers: this.loggingConfig?.includeHeaders
                ? this.sanitizeHeaders(
                    config.headers as Record<string, unknown>,
                  )
                : undefined,
              data: this.loggingConfig?.includeBody
                ? this.sanitizeBody(config.data)
                : undefined,
            },
            method,
          );
        }

        return config;
      },
      (error: AxiosError) => {
        if (this.shouldLogType(LOG_TYPES.ERROR)) {
          this.emitLog(
            LOG_TYPES.ERROR,
            {
              phase: "request",
              message: String(error.message),
              url: this.resolveRequestUrl(error.config),
            },
            "request",
          );
        }

        return Promise.reject(error);
      },
    );

    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        if (this.shouldLogType(LOG_TYPES.RESPONSE)) {
          const logContext = this.extractLogContext(response.config);
          const startedAt = (
            response.config as unknown as Record<string, unknown>
          ).__httpStartedAt as number | undefined;
          const durationMs = startedAt ? Date.now() - startedAt : undefined;
          const method = String(
            (response.config as any)?.method || HttpMethod.GET,
          ).toLowerCase();

          this.emitLog(
            LOG_TYPES.RESPONSE,
            {
              method: method.toUpperCase(),
              url: this.resolveRequestUrl(response.config),
              source: this.buildSource(logContext),
              requestId: logContext.requestId,
              status: response.status,
              durationMs,
              headers: this.loggingConfig?.includeHeaders
                ? this.sanitizeHeaders(
                    response.headers as Record<string, unknown>,
                  )
                : undefined,
              data: this.loggingConfig?.includeBody
                ? this.sanitizeBody(response.data)
                : undefined,
            },
            method,
          );
        }

        return response;
      },
      (error: AxiosError) => {
        if (this.shouldLogType(LOG_TYPES.ERROR)) {
          const cfg = error.config as unknown;
          const logContext = this.extractLogContext(cfg);
          const startedAt = (cfg as Record<string, unknown>)
            ?.__httpStartedAt as number | undefined;
          const durationMs = startedAt ? Date.now() - startedAt : undefined;
          const method = String(
            (cfg as any)?.method || HttpMethod.GET,
          ).toLowerCase();

          this.emitLog(
            LOG_TYPES.ERROR,
            {
              phase: "response",
              method: method.toUpperCase(),
              url: this.resolveRequestUrl(cfg),
              source: this.buildSource(logContext),
              requestId: logContext.requestId,
              status: error.response?.status,
              durationMs,
              message: String(error.message),
              responseData: this.loggingConfig?.includeBody
                ? this.sanitizeBody(error.response?.data)
                : undefined,
            },
            method,
          );
        }

        return Promise.reject(error);
      },
    );
  }

  private isLoggingEnabled(): boolean {
    if (!this.loggingConfig?.enabled) {
      return false;
    }

    const envs = this.loggingConfig.environments;
    if (!envs || envs.length === 0) {
      return true;
    }

    const currentEnv = process.env.NODE_ENV || "development";
    return envs.includes(currentEnv);
  }

  private shouldLogType(type: HttpLogType): boolean {
    if (!this.isLoggingEnabled()) {
      return false;
    }

    const types = this.loggingConfig?.types;
    if (!types || types.length === 0) {
      return true;
    }

    return types.includes(type);
  }

  private emitLog(
    type: HttpLogType,
    meta?: Record<string, unknown>,
    libMethod?: string,
  ): void {
    const context = this.loggingConfig?.context || "HttpClient";
    const methodValue = this.metaValueToString(meta?.method);
    const urlValue = this.metaValueToString(meta?.url);
    const statusValue = this.metaValueToString(meta?.status);
    const durationValue = this.metaValueToString(meta?.durationMs);

    const method = methodValue ? `[${methodValue}]` : "";
    const url = urlValue || "";
    const status = statusValue ? `[${statusValue}]` : "";
    const duration = durationValue ? ` (${durationValue}ms)` : "";

    let message = "HTTP request";
    if (type === LOG_TYPES.REQUEST) {
      message = `HTTP Request ${method} ${url}`;
    } else if (type === LOG_TYPES.RESPONSE) {
      message = `HTTP Response ${status} ${method} ${url}${duration}`;
    } else if (type === LOG_TYPES.ERROR) {
      message = `HTTP Error ${status} ${method} ${url}${duration}`;
    }

    const normalizedMeta = this.normalizeMetaForLogging(meta);

    if (this.logger) {
      const payload = {
        message,
        context,
        lib: LIB_NAME,
        libVersion: LIB_VERSION,
        meta: normalizedMeta,
        source: meta?.source,
        libMethod,
      } as any;

      if (type === LOG_TYPES.ERROR) {
        this.logger.error(payload);
        return;
      }

      this.logger.info(payload);
      return;
    }

    if (type === LOG_TYPES.ERROR) {
      console.error(`[${context}] ${message}`, normalizedMeta);
      return;
    }

    console.log(`[${context}] ${message}`, normalizedMeta);
  }

  private metaValueToString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return this.stringifyForLog(value);
  }

  private normalizeMetaForLogging(
    meta?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!meta) {
      return undefined;
    }

    const entries = Object.entries(meta)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, this.normalizeMetaValue(key, value)]);

    return Object.fromEntries(entries);
  }

  private normalizeMetaValue(key: string, value: unknown): unknown {
    if (value === undefined || value === null) {
      return value;
    }

    if (key === "data" || key === "responseData") {
      return this.stringifyForLog(value);
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      const cleanedEntries = Object.entries(
        value as Record<string, unknown>,
      ).filter(([, v]) => v !== undefined);
      return Object.fromEntries(cleanedEntries);
    }

    return value;
  }

  private stringifyForLog(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }

    if (value instanceof Error) {
      return value.message;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  }

  private resolveRequestUrl(config?: any): string {
    if (!config?.url) return "";
    const url = String(config.url);
    const base = config.baseURL ? String(config.baseURL) : undefined;
    if (!base) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `${base}${url}`;
  }

  private sanitizeHeaders(
    headers?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!headers) {
      return undefined;
    }

    const sanitized = { ...headers };
    const authorization =
      sanitized.Authorization || sanitized.authorization || undefined;

    if (authorization && typeof authorization === "string") {
      const token = authorization.includes(" ")
        ? authorization.split(" ").slice(1).join(" ")
        : authorization;
      const prefix = authorization.includes(" ")
        ? `${authorization.split(" ")[0]} `
        : "";

      const masked = `${prefix}${AxiosHttpProvider.maskToken(token, 6)}`;

      if (sanitized.Authorization) {
        sanitized.Authorization = masked;
      }

      if (sanitized.authorization) {
        sanitized.authorization = masked;
      }
    }

    return sanitized;
  }

  /**
   * Redacts sensitive information from the request/response body.
   */
  private sanitizeBody(data: any): any {
    if (!data || typeof data !== "object") {
      return data;
    }

    try {
      const keysToMask = new Set([
        "access_token",
        "refresh_token",
        "password",
        "client_secret",
        "id_token",
      ]);
      // Work with a copy to avoid mutating the original response/request object
      const sanitized = Array.isArray(data) ? [...data] : { ...data };

      for (const key of Object.keys(sanitized)) {
        if (
          keysToMask.has(key.toLowerCase()) &&
          typeof sanitized[key] === "string"
        ) {
          sanitized[key] = AxiosHttpProvider.maskToken(sanitized[key], 6);
        } else if (
          typeof sanitized[key] === "object" &&
          sanitized[key] !== null
        ) {
          sanitized[key] = this.sanitizeBody(sanitized[key]);
        }
      }

      return sanitized;
    } catch {
      return "[redacted due to sanitization error]";
    }
  }

  private extractLogContext(config?: unknown): HttpRequestLogContext {
    const requestLogContext = ((config as Record<string, unknown>)
      ?.logContext || {}) as HttpRequestLogContext;
    const decoratorContext = getHttpRequestContext();
    // Fallback: logContext stored in logger AsyncLocalStorage (set by caller via runWithContext)
    const asyncCtx = getContext();
    const asyncLogContext = asyncCtx?.logContext as
      | HttpRequestLogContext
      | undefined;

    const requestIdHeaderName = this.getRequestIdHeaderName();
    const requestIdFromHeader = this.getHeaderValue({
      config,
      headerName: requestIdHeaderName,
    });

    let resolvedRequestId =
      requestLogContext.requestId ||
      requestIdFromHeader ||
      decoratorContext?.requestId ||
      (asyncCtx?.requestId as string | undefined);

    if (!resolvedRequestId && this.shouldAutoGenerateRequestId()) {
      resolvedRequestId = randomUUID();
      this.setHeaderValue({
        config,
        headerName: requestIdHeaderName,
        value: resolvedRequestId,
      });
    }

    return {
      className:
        requestLogContext.className ||
        decoratorContext?.className ||
        asyncLogContext?.className,
      methodName:
        requestLogContext.methodName ||
        decoratorContext?.methodName ||
        asyncLogContext?.methodName,
      requestId: resolvedRequestId,
    };
  }

  private getRequestIdHeaderName(): string {
    return (
      this.loggingConfig?.requestId?.headerName || HEADERS_PARAMS.REQUEST_ID
    );
  }

  private shouldAutoGenerateRequestId(): boolean {
    return Boolean(this.loggingConfig?.requestId?.autoGenerateIfMissing);
  }

  private getHeaderValue({
    config,
    headerName,
  }: {
    config: unknown;
    headerName: string;
  }): string | undefined {
    const headers = (config as Record<string, unknown>)?.headers;
    if (!headers) {
      return undefined;
    }

    if (typeof (headers as any)?.get === "function") {
      const val = (headers as any).get(headerName);
      return typeof val === "string" ? val : undefined;
    }

    const normalizedName = headerName.toLowerCase();
    const entries = Object.entries(headers as Record<string, unknown>);
    for (const [key, value] of entries) {
      if (key.toLowerCase() === normalizedName && typeof value === "string") {
        return value;
      }
    }

    return undefined;
  }

  private setHeaderValue({
    config,
    headerName,
    value,
  }: {
    config: unknown;
    headerName: string;
    value: string;
  }): void {
    if (!config) {
      return;
    }

    const headers = (config as Record<string, unknown>)?.headers as
      | Record<string, unknown>
      | undefined;
    if (!headers) {
      (config as Record<string, unknown>).headers = {
        [headerName]: value,
      } as unknown;
      return;
    }

    if (typeof (headers as any).set === "function") {
      (headers as any).set(headerName, value);
      return;
    }

    headers[headerName] = value;
  }

  private buildSource(logContext: HttpRequestLogContext): string | undefined {
    if (logContext.className && logContext.methodName) {
      return `${logContext.className}.${logContext.methodName}`;
    }

    if (logContext.className) {
      return logContext.className;
    }

    if (logContext.methodName) {
      return logContext.methodName;
    }

    return undefined;
  }

  /**
   * Generates a cache key from URL and config
   */
  private generateCacheKey({ url, config }: GenerateCacheKeyParams): string {
    // If caller provided an explicit cacheKey in the request config, use it
    if (config && Object.hasOwn(config, "cacheKey")) {
      return `${this.cacheKeyPrefix}${(config as any).cacheKey}`;
    }

    const params = config?.params ? JSON.stringify(config.params) : "";
    return `${this.cacheKeyPrefix}${url}${params}`;
  }

  /**
   * Gets cached data if valid
   */
  private async getCached<T>(key: string): Promise<T | null> {
    if (!this.cacheProvider) return null;
    return this.cacheProvider.get<T>({ key });
  }

  /**
   * Sets data in cache
   */
  private async setCache<T>({
    key,
    data,
    ttl = this.defaultCacheTtl,
  }: SetCacheParams<T>): Promise<void> {
    if (!this.cacheProvider) return;
    await this.cacheProvider.set({
      key,
      value: data,
      ttlInSeconds: ttl / 1000,
    }); // converting ms to seconds for consistency
  }

  /**
   * Clears cache for a specific key or all cache
   */
  async clearCache(key?: string): Promise<void> {
    if (!this.cacheProvider) return;
    if (key) {
      await this.cacheProvider.del({ key });
    } else {
      await this.cacheProvider.clear();
    }
  }

  /**
   * Gets cache statistics (Not supported for external providers)
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: 0,
      keys: [],
    };
  }

  /**
   * Sets a global header that will be included in all requests.
   */
  setGlobalHeader({ key, value }: SetGlobalHeaderParams): void {
    this.axiosInstance.defaults.headers.common[key] = value;
  }

  /**
   * Removes a global header.
   */
  removeGlobalHeader(key: string): void {
    delete this.axiosInstance.defaults.headers.common[key];
  }

  /**
   * Gets all global headers currently set.
   */
  getGlobalHeaders(): Record<string, string> {
    return { ...this.axiosInstance.defaults.headers.common } as Record<
      string,
      string
    >;
  }

  /**
   * Sets the base URL for all requests.
   */
  setBaseUrl(baseUrl: string): void {
    this.axiosInstance.defaults.baseURL = baseUrl;
  }

  /**
   * Gets the current base URL.
   */
  getBaseUrl(): string {
    return this.axiosInstance.defaults.baseURL || "";
  }

  /**
   * Sets the default timeout for all requests.
   */
  setDefaultTimeout(timeout: number): void {
    this.axiosInstance.defaults.timeout = timeout;
  }

  /**
   * Adds an error interceptor for handling errors globally.
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): number {
    const id = this.nextErrorInterceptorId++;
    this.errorInterceptors.set(id, interceptor);
    return id;
  }

  /**
   * Adds a request interceptor to the underlying Axios instance.
   */
  addRequestInterceptor(
    onFulfilled: (config: unknown) => unknown,
    onRejected?: (error: unknown) => unknown,
  ): number {
    const id = this.axiosInstance.interceptors.request.use(
      onFulfilled as any,
      onRejected as any,
    );
    this.requestInterceptorIds.add(id);
    return id;
  }

  /**
   * Removes a request interceptor by id.
   */
  removeRequestInterceptor(id: number): void {
    this.axiosInstance.interceptors.request.eject(id);
    this.requestInterceptorIds.delete(id);
  }

  /**
   * Adds a response interceptor to the underlying Axios instance.
   */
  addResponseInterceptor(
    onFulfilled: (res: unknown) => unknown,
    onRejected?: (error: unknown) => unknown,
  ): number {
    const id = this.axiosInstance.interceptors.response.use(
      onFulfilled as any,
      onRejected as any,
    );
    this.responseInterceptorIds.add(id);
    return id;
  }

  /**
   * Removes a response interceptor by id.
   */
  removeResponseInterceptor(id: number): void {
    this.axiosInstance.interceptors.response.eject(id);
    this.responseInterceptorIds.delete(id);
  }

  /**
   * Removes an error interceptor by its ID.
   */
  removeErrorInterceptor(id: number): void {
    this.errorInterceptors.delete(id);
  }

  /**
   * Performs a GET request to the specified URL.
   */
  async get<T>({ url, config }: UrlConfig): Promise<HttpResponse<T>> {
    const cacheKey = this.generateCacheKey({ url, config });
    const logContext = (config as any)?.logContext;
    const withCallerCtx = <R>(fn: () => Promise<R>): Promise<R> => {
      if (!logContext) return fn();
      const current = getContext() ?? {};
      return runWithContext({ ...current, logContext }, fn);
    };

    const cached = await withCallerCtx(() => this.getCached<T>(cacheKey));
    if (cached) {
      return {
        data: cached,
        status: 200,
        statusText: DEFAULTS.STATUS_TEXT_OK,
        headers: {},
        config: config || { url },
      } as HttpResponse<T>;
    }

    return this.wrapWithErrorInterceptors(() =>
      withCallerCtx(() => this.performGet<T>({ url, config, cacheKey })),
    );
  }

  /**
   * Internal method to perform the actual GET request.
   */
  private async performGet<T>({
    url,
    config,
    cacheKey,
  }: PerformGetParams): Promise<HttpResponse<T>> {
    const response = await this.axiosInstance.get<T>(url, config);
    const transformed = this.transformResponse<T>(response);

    if (cacheKey && config?.cache !== false) {
      this.setCache({
        key: cacheKey,
        data: transformed.data,
        ttl: config?.cacheTtl,
      });
    }

    return transformed;
  }

  /**
   * Performs a GET request and returns an Observable.
   */
  get$<T>({ url, config }: UrlConfig): Observable<HttpResponse<T>> {
    return from(this.get<T>({ url, config }));
  }

  /**
   * Performs a POST request.
   */
  async post<T>({
    url,
    data,
    config,
  }: UrlDataConfig): Promise<HttpResponse<T>> {
    return this.wrapWithErrorInterceptors(() =>
      this.performPost<T>({ url, data, config }),
    );
  }

  /**
   * Internal method to perform the actual POST request.
   */
  private async performPost<T>({
    url,
    data,
    config,
  }: UrlDataConfig): Promise<HttpResponse<T>> {
    const response = await this.axiosInstance.post<T>(url, data, config);
    return this.transformResponse<T>(response);
  }

  /**
   * Performs a POST request and returns an Observable.
   */
  post$<T>({ url, data, config }: UrlDataConfig): Observable<HttpResponse<T>> {
    return from(this.post<T>({ url, data, config }));
  }

  /**
   * Performs a PUT request.
   */
  async put<T>({ url, data, config }: UrlDataConfig): Promise<HttpResponse<T>> {
    return this.wrapWithErrorInterceptors(() =>
      this.performPut<T>({ url, data, config }),
    );
  }

  /**
   * Internal method to perform the actual PUT request.
   */
  private async performPut<T>({
    url,
    data,
    config,
  }: UrlDataConfig): Promise<HttpResponse<T>> {
    const response = await this.axiosInstance.put<T>(url, data, config);
    return this.transformResponse<T>(response);
  }

  /**
   * Performs a PUT request and returns an Observable.
   */
  put$<T>({ url, data, config }: UrlDataConfig): Observable<HttpResponse<T>> {
    return from(this.put<T>({ url, data, config }));
  }

  /**
   * Performs a PATCH request.
   */
  async patch<T>({
    url,
    data,
    config,
  }: UrlDataConfig): Promise<HttpResponse<T>> {
    return this.wrapWithErrorInterceptors(() =>
      this.performPatch<T>({ url, data, config }),
    );
  }

  /**
   * Internal method to perform the actual PATCH request.
   */
  private async performPatch<T>({
    url,
    data,
    config,
  }: UrlDataConfig): Promise<HttpResponse<T>> {
    const response = await this.axiosInstance.patch<T>(url, data, config);
    return this.transformResponse<T>(response);
  }

  /**
   * Performs a PATCH request and returns an Observable.
   */
  patch$<T>({ url, data, config }: UrlDataConfig): Observable<HttpResponse<T>> {
    return from(this.patch<T>({ url, data, config }));
  }

  /**
   * Performs a DELETE request.
   */
  async delete<T>({ url, config }: UrlConfig): Promise<HttpResponse<T>> {
    return this.wrapWithErrorInterceptors(() =>
      this.performDelete<T>({ url, config }),
    );
  }

  /**
   * Internal method to perform the actual DELETE request.
   */
  private async performDelete<T>({
    url,
    config,
  }: UrlConfig): Promise<HttpResponse<T>> {
    const response = await this.axiosInstance.delete<T>(url, config);
    return this.transformResponse<T>(response);
  }

  /**
   * Performs a DELETE request and returns an Observable.
   */
  delete$<T>({ url, config }: UrlConfig): Observable<HttpResponse<T>> {
    return from(this.delete<T>({ url, config }));
  }

  /**
   * Performs a HEAD request.
   */
  async head<T>({ url, config }: UrlConfig): Promise<HttpResponse<T>> {
    return this.wrapWithErrorInterceptors(() =>
      this.performHead<T>({ url, config }),
    );
  }

  /**
   * Internal method to perform the actual HEAD request.
   */
  private async performHead<T>({
    url,
    config,
  }: UrlConfig): Promise<HttpResponse<T>> {
    const response = await this.axiosInstance.head<T>(url, config);
    return this.transformResponse<T>(response);
  }

  /**
   * Performs a HEAD request and returns an Observable.
   */
  head$<T>({ url, config }: UrlConfig): Observable<HttpResponse<T>> {
    return from(this.head<T>({ url, config }));
  }

  /**
   * Performs an OPTIONS request.
   */
  async options<T>({ url, config }: UrlConfig): Promise<HttpResponse<T>> {
    return this.wrapWithErrorInterceptors(() =>
      this.performOptions<T>({ url, config }),
    );
  }

  /**
   * Internal method to perform the actual OPTIONS request.
   */
  private async performOptions<T>({
    url,
    config,
  }: UrlConfig): Promise<HttpResponse<T>> {
    const response = await this.axiosInstance.options<T>(url, config);
    return this.transformResponse<T>(response);
  }

  /**
   * Performs an OPTIONS request and returns an Observable.
   */
  options$<T>({ url, config }: UrlConfig): Observable<HttpResponse<T>> {
    return from(this.options<T>({ url, config }));
  }

  /**
   * Performs a custom HTTP request.
   */
  async request<T>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.wrapWithErrorInterceptors(() => this.performRequest<T>(config));
  }

  /**
   * Internal method to perform the actual custom request.
   */
  private async performRequest<T>(
    config: HttpRequestConfig,
  ): Promise<HttpResponse<T>> {
    const response = await this.axiosInstance.request<T>(config);
    return this.transformResponse<T>(response);
  }

  /**
   * Performs a custom HTTP request and returns an Observable.
   */
  request$<T>(config: HttpRequestConfig): Observable<HttpResponse<T>> {
    return from(this.request<T>(config));
  }

  /**
   * Sets the authorization token for requests.
   */
  setAuthToken({ token, type = AUTH_SCHEME.BEARER }: SetAuthTokenParams): void {
    this.axiosInstance.defaults.headers.common[HEADERS_PARAMS.AUTHORIZATION] =
      `${type} ${token}`;
    // Log only the initial part of the token to avoid exposing the full secret in logs
    try {
      const masked = AxiosHttpProvider.maskToken(token);

      this.logger?.debug?.({ message: `setAuthToken ${type} ${masked}` });
    } catch (err) {
      this.logger?.warn?.({
        message: "setAuthToken logging failed",
        meta: { error: this.stringifyForLog(err) },
      });
    }
  }

  /**
   * Clears the authorization token.
   */
  clearAuthToken(): void {
    delete this.axiosInstance.defaults.headers.common[
      HEADERS_PARAMS.AUTHORIZATION
    ];
  }

  /**
   * Processes an error through all registered error interceptors.
   */
  private async processErrorInterceptors(error: unknown): Promise<unknown> {
    let processedError = error;

    for (const interceptor of this.errorInterceptors.values()) {
      try {
        processedError = await interceptor(processedError);
      } catch (interceptorError) {
        this.logger?.warn?.({
          message: "Error interceptor failed",
          meta: { error: interceptorError },
        });
      }
    }

    return processedError;
  }

  /**
   * Returns a masked version of the token showing only the initial characters.
   */
  private static maskToken(token: string, visibleChars = 8): string {
    if (!token || typeof token !== "string") return "";
    return token.length <= visibleChars
      ? token
      : `${token.slice(0, visibleChars)}...`;
  }

  /**
   * Wraps a promise-returning HTTP method with error interceptor processing.
   */
  private async wrapWithErrorInterceptors<T>(
    method: () => Promise<HttpResponse<T>>,
  ): Promise<HttpResponse<T>> {
    try {
      return await method();
    } catch (error) {
      const processedError = await this.processErrorInterceptors(error);
      // Map to a normalized application error with context
      try {
        const mapper = new ErrorMapperService();
        const mapped = mapper.mapUpstreamError(processedError) as {
          message?: string;
          status?: number;
          code?: string;
          context?: Record<string, unknown>;
        };
        const _msg: string = String(mapped.message ?? "HTTP client error");
        throw new HttpClientError({
          message: _msg,
          status: mapped.status,
          code: mapped.code,
          context: mapped.context,
        });
      } catch {
        // If mapping fails, rethrow a generic HttpClientError with minimal context
        const fallback = new HttpClientError({
          message:
            (processedError &&
              (processedError as Record<string, unknown>).message) ||
            "HTTP client error",
          status:
            ((processedError &&
              (processedError as Record<string, unknown>).status) as number) ||
            502,
          code: (processedError &&
            (processedError as Record<string, unknown>).code) as
            | string
            | undefined,
          context: { original: this.stringifyForLog(processedError) },
        });
        throw fallback;
      }
    }
  }

  /**
   * Transforms an Axios response to the standardized HTTP response format.
   */
  private transformResponse<T>(response: AxiosResponse<T>): HttpResponse<T> {
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
      config: response.config as HttpRequestConfig,
    };
  }
}
