import { DynamicModule, Module, Provider } from "@nestjs/common";
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
// Avoid importing the logger package here to prevent d.ts resolution issues during
// the http package build; use the literal token string instead where needed.
import { HttpModuleOptions } from "../../http.interface";
import type {
  AxiosForRootParam,
  AxiosForRootOptions,
} from "./types/axios.module.types";
import { HTTP_AXIOS_CONNECTION, HTTP_AXIOS_PROVIDER } from "../../http.token";
import { AxiosHttpProvider } from "./axios.http.provider";

@Module({})
export class HttpImplementationAxiosModule {
  static forRoot(
    configOrOptions?: AxiosForRootParam,
    options?: AxiosForRootOptions,
  ): DynamicModule {
    // support both (config, options) and single object { config, options }
    let config: AxiosRequestConfig | AxiosInstance | undefined;
    let opts: HttpModuleOptions | undefined;

    if (
      configOrOptions &&
      typeof configOrOptions === "object" &&
      ("config" in (configOrOptions as any) ||
        "options" in (configOrOptions as any))
    ) {
      config = (configOrOptions as any).config;
      opts = (configOrOptions as any).options;
    } else {
      config = configOrOptions as
        | AxiosRequestConfig
        | AxiosInstance
        | undefined;
      opts = options;
    }

    const axiosInstance: AxiosInstance =
      config && (config as AxiosInstance).request
        ? (config as AxiosInstance)
        : axios.create(config as AxiosRequestConfig);

    const httpToken = opts?.provide || HTTP_AXIOS_PROVIDER;

    const providers: Provider[] = [
      {
        provide: HTTP_AXIOS_CONNECTION,
        useValue: axiosInstance,
      },
      {
        provide: httpToken,
        useFactory: (conn: AxiosInstance, logger?: any, cache?: any) =>
          new AxiosHttpProvider(conn, {
            logger,
            logging: opts?.logging,
            cache: opts?.cache as any,
          }, cache),
        inject: [
          HTTP_AXIOS_CONNECTION,
          { token: "LOGGER_PROVIDER", optional: true },
          { token: opts?.cacheToken || "CACHE_PROVIDER", optional: true },
        ],
      },
    ];

    return {
      module: HttpImplementationAxiosModule,
      providers,
      exports: [HTTP_AXIOS_CONNECTION, httpToken],
    };
  }
}
