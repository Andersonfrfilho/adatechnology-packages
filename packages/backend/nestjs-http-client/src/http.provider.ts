import { Injectable, Inject } from "@nestjs/common";
import { Observable } from "rxjs";

import {
  ErrorInterceptor,
  HttpConfigWithoutUrlAndMethod,
  HttpConfigWithoutUrlMethodAndData,
  HttpProviderInterface,
  HttpRequestConfig,
  HttpResponse,
} from "./http.interface";
import type { AxiosHttpProviderInterface } from "./implementations/axios/axios.http.interfaces";
import {
  SetGlobalHeaderParams,
  SetAuthTokenParams,
} from "./implementations/axios/types/axios.http.params";
import { HTTP_AXIOS_PROVIDER } from "./http.token";

@Injectable()
export class HttpProvider implements HttpProviderInterface {
  constructor(
    @Inject(HTTP_AXIOS_PROVIDER)
    private readonly axiosHttpProvider: AxiosHttpProviderInterface,
  ) {}

  /**
   * Expose underlying axios instance when available from the axios provider implementation.
   * This is intentionally typed as unknown/any to avoid leaking implementation details.
   */
  getAxiosInstance(): unknown {
    try {
      // Some implementations expose `axiosInstance` or `instance`.
      // Use brute-force access guarded in try/catch to avoid runtime errors.

      const provider = this.axiosHttpProvider as unknown as Record<
        string,
        unknown
      >;
      return provider?.axiosInstance ?? provider?.instance;
    } catch {
      return undefined;
    }
  }

  get<T>(params: {
    url: string;
    config?: HttpConfigWithoutUrlAndMethod;
  }): Promise<HttpResponse<T>> {
    return this.axiosHttpProvider.get<T>(params);
  }

  get$<T>(params: {
    url: string;
    config?: HttpConfigWithoutUrlAndMethod;
  }): Observable<HttpResponse<T>> {
    return this.axiosHttpProvider.get$<T>(params);
  }

  post<T>(params: {
    url: string;
    data?: unknown;
    config?: HttpConfigWithoutUrlMethodAndData;
  }): Promise<HttpResponse<T>> {
    return this.axiosHttpProvider.post<T>(params);
  }

  post$<T>(params: {
    url: string;
    data?: unknown;
    config?: HttpConfigWithoutUrlMethodAndData;
  }): Observable<HttpResponse<T>> {
    return this.axiosHttpProvider.post$<T>(params);
  }

  put<T>(params: {
    url: string;
    data?: unknown;
    config?: HttpConfigWithoutUrlMethodAndData;
  }): Promise<HttpResponse<T>> {
    return this.axiosHttpProvider.put<T>(params);
  }

  put$<T>(params: {
    url: string;
    data?: unknown;
    config?: HttpConfigWithoutUrlMethodAndData;
  }): Observable<HttpResponse<T>> {
    return this.axiosHttpProvider.put$<T>(params);
  }

  patch<T>(params: {
    url: string;
    data?: unknown;
    config?: HttpConfigWithoutUrlMethodAndData;
  }): Promise<HttpResponse<T>> {
    return this.axiosHttpProvider.patch<T>(params);
  }

  patch$<T>(params: {
    url: string;
    data?: unknown;
    config?: HttpConfigWithoutUrlMethodAndData;
  }): Observable<HttpResponse<T>> {
    return this.axiosHttpProvider.patch$<T>(params);
  }

  delete<T>(params: {
    url: string;
    config?: HttpConfigWithoutUrlAndMethod;
  }): Promise<HttpResponse<T>> {
    return this.axiosHttpProvider.delete<T>(params);
  }

  delete$<T>(params: {
    url: string;
    config?: HttpConfigWithoutUrlAndMethod;
  }): Observable<HttpResponse<T>> {
    return this.axiosHttpProvider.delete$<T>(params);
  }

  head<T>(params: {
    url: string;
    config?: HttpConfigWithoutUrlAndMethod;
  }): Promise<HttpResponse<T>> {
    return this.axiosHttpProvider.head<T>(params);
  }

  head$<T>(params: {
    url: string;
    config?: HttpConfigWithoutUrlAndMethod;
  }): Observable<HttpResponse<T>> {
    return this.axiosHttpProvider.head$<T>(params);
  }

  options<T>(params: {
    url: string;
    config?: HttpConfigWithoutUrlAndMethod;
  }): Promise<HttpResponse<T>> {
    return this.axiosHttpProvider.options<T>(params);
  }

  options$<T>(params: {
    url: string;
    config?: HttpConfigWithoutUrlAndMethod;
  }): Observable<HttpResponse<T>> {
    return this.axiosHttpProvider.options$<T>(params);
  }

  async request<T>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.axiosHttpProvider.request<T>(config);
  }

  request$<T>(config: HttpRequestConfig): Observable<HttpResponse<T>> {
    return this.axiosHttpProvider.request$<T>(config);
  }

  setGlobalHeader(params: { key: string; value: string }): void;
  setGlobalHeader(key: string, value: string): void;
  setGlobalHeader(
    keyOrParams: string | SetGlobalHeaderParams,
    value?: string,
  ): void {
    if (typeof keyOrParams === "string") {
      if (value === undefined) {
        throw new Error(
          "setGlobalHeader: value is required when key is a string",
        );
      }
      this.axiosHttpProvider.setGlobalHeader({
        key: keyOrParams,
        value,
      });
      return;
    }

    this.axiosHttpProvider.setGlobalHeader(keyOrParams);
  }

  removeGlobalHeader(key: string): void {
    this.axiosHttpProvider.removeGlobalHeader(key);
  }

  getGlobalHeaders(): Record<string, string> {
    return this.axiosHttpProvider.getGlobalHeaders();
  }

  setBaseUrl(baseUrl: string): void {
    this.axiosHttpProvider.setBaseUrl(baseUrl);
  }

  getBaseUrl(): string {
    return this.axiosHttpProvider.getBaseUrl();
  }

  setDefaultTimeout(timeout: number): void {
    this.axiosHttpProvider.setDefaultTimeout(timeout);
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): number {
    return this.axiosHttpProvider.addErrorInterceptor(interceptor);
  }

  removeErrorInterceptor(id: number): void {
    this.axiosHttpProvider.removeErrorInterceptor(id);
  }

  async clearCache(key?: string): Promise<void> {
    await this.axiosHttpProvider.clearCache(key);
  }

  setAuthToken(params: { token: string; type?: string }): void;
  setAuthToken(token: string, type?: string): void;
  setAuthToken(
    tokenOrParams: string | SetAuthTokenParams,
    type?: string,
  ): void {
    if (typeof tokenOrParams === "string") {
      this.axiosHttpProvider.setAuthToken({ token: tokenOrParams, type });
      return;
    }

    this.axiosHttpProvider.setAuthToken(tokenOrParams);
  }

  clearAuthToken(): void {
    this.axiosHttpProvider.clearAuthToken();
  }

  addRequestInterceptor(
    onFulfilled: (config: unknown) => unknown,
    onRejected?: (error: unknown) => unknown,
  ): number {
    return this.axiosHttpProvider.addRequestInterceptor(
      onFulfilled,
      onRejected,
    );
  }

  removeRequestInterceptor(id: number): void {
    this.axiosHttpProvider.removeRequestInterceptor(id);
  }

  addResponseInterceptor(
    onFulfilled: (response: unknown) => unknown,
    onRejected?: (error: unknown) => unknown,
  ): number {
    return this.axiosHttpProvider.addResponseInterceptor(
      onFulfilled,
      onRejected,
    );
  }

  removeResponseInterceptor(id: number): void {
    this.axiosHttpProvider.removeResponseInterceptor(id);
  }
}
