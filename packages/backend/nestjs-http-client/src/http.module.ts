import { DynamicModule, Global, Module, Provider } from "@nestjs/common";
import axios from "axios";
import { AxiosHttpProvider } from "./implementations/axios/axios.http.provider";
import { HTTP_PROVIDER } from "./http.token";
import {
  CACHE_PROVIDER,
  InMemoryCacheProvider,
  RedisCacheProvider,
} from "@adatechnology/nestjs-cache";
import { HttpModuleOptions } from "./http.interface";
import { validateHttpForRoot, validateHttpForRootAsync } from "./validators/validate-http-config";

@Global()
@Module({})
export class HttpModule {
  /**
   * Universal forRoot for the HTTP module.
   */
  static forRoot(
    configOrOptions: any = {},
    options: HttpModuleOptions = {},
  ): DynamicModule {
    validateHttpForRoot(configOrOptions, options);

    const httpToken = options.provide || HTTP_PROVIDER;
    const cacheToken = options.cacheToken || CACHE_PROVIDER;

    const providers: Provider[] = this.createCacheProviders(
      configOrOptions,
      options,
      cacheToken,
    );

    providers.push({
      provide: httpToken,
      useFactory: (cache?: any, logger?: any) => {
        const isAxiosConfig =
          configOrOptions.baseURL ||
          configOrOptions.timeout ||
          configOrOptions.headers;
        const axiosConfig = isAxiosConfig ? configOrOptions : undefined;
        const opts = isAxiosConfig ? options : configOrOptions;

        const axiosInstance = axiosConfig
          ? axios.create(axiosConfig)
          : undefined;
        return new AxiosHttpProvider(axiosInstance, opts, cache, logger);
      },
      inject: [
        { token: cacheToken, optional: true },
        { token: "LOGGER_PROVIDER", optional: true },
      ],
    });

    return {
      module: HttpModule,
      providers,
      exports: [httpToken],
    };
  }

  static forRootAsync(options: {
    imports?: any[];
    useFactory: (
      ...args: any[]
    ) =>
      | Promise<{ config: any; options: HttpModuleOptions }>
      | { config: any; options: HttpModuleOptions };
    inject?: any[];
    provide?: any;
    cacheToken?: any;
  }): DynamicModule {
    validateHttpForRootAsync(options);

    const httpToken = options.provide || HTTP_PROVIDER;
    const cacheToken = options.cacheToken || CACHE_PROVIDER;

    return {
      module: HttpModule,
      imports: options.imports || [],
      providers: [
        {
          provide: "HTTP_MODULE_OPTIONS",
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: cacheToken,
          useFactory: async (moduleOptions: {
            config: any;
            options: HttpModuleOptions;
          }) => {
            const { config, options: httpOptions } = moduleOptions;
            const shouldUseCache =
              config.useCache !== false && httpOptions.useCache !== false;

            if (!shouldUseCache) {
              return null;
            }

            if (httpOptions.cacheInstance !== undefined) {
              return httpOptions.cacheInstance;
            }

            if (httpOptions.cacheProvider) {
              // Note: If cacheProvider is a token, this factory won't be able to resolve it easily here.
              // We assume it's a class or value if passed in options.
              return httpOptions.cacheProvider;
            }

            if (httpOptions.cache?.redisOptions) {
              return new RedisCacheProvider(httpOptions.cache.redisOptions);
            }

            return new InMemoryCacheProvider();
          },
          inject: ["HTTP_MODULE_OPTIONS"],
        },
        {
          provide: httpToken,
          useFactory: (
            moduleOptions: { config: any; options: HttpModuleOptions },
            cache?: any,
            logger?: any,
          ) => {
            const { config, options: httpOptions } = moduleOptions;
            const isAxiosConfig =
              config.baseURL || config.timeout || config.headers;
            const axiosConfig = isAxiosConfig ? config : undefined;
            const axiosInstance = axiosConfig
              ? axios.create(axiosConfig)
              : undefined;
            return new AxiosHttpProvider(
              axiosInstance,
              httpOptions,
              cache,
              logger,
            );
          },
          inject: [
            "HTTP_MODULE_OPTIONS",
            { token: cacheToken, optional: true },
            { token: "LOGGER_PROVIDER", optional: true },
          ],
        },
      ],
      exports: [httpToken],
    };
  }

  private static createCacheProviders(
    configOrOptions: any,
    options: HttpModuleOptions,
    cacheToken: any,
  ): Provider[] {
    const providers: Provider[] = [];
    const shouldUseCache =
      configOrOptions.useCache !== false && options.useCache !== false;

    if (shouldUseCache) {
      if (options.cacheInstance !== undefined) {
        providers.push({
          provide: cacheToken,
          useValue: options.cacheInstance,
        });
      } else if (options.cacheProvider) {
        const maybeProvider = options.cacheProvider as Provider;
        const looksLikeProvider =
          maybeProvider && (maybeProvider as any).provide;
        if (looksLikeProvider) {
          providers.push({
            ...maybeProvider,
            provide: cacheToken,
          } as any);
        } else {
          // assume it's a token
        }
      } else if (options.cache?.redisOptions) {
        providers.push({
          provide: cacheToken,
          useFactory: () => new RedisCacheProvider(options.cache.redisOptions),
        });
      } else {
        providers.push({
          provide: cacheToken,
          useClass: InMemoryCacheProvider,
        });
      }
    }
    return providers;
  }
}
