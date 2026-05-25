import { DynamicModule, Module, Scope, Provider, Global } from "@nestjs/common";
import { LoggerProvider } from "./logger.provider";
import { LOGGER_PROVIDER, LOGGER_CONFIG, HTTP_LOGGING_INTERCEPTOR } from "./logger.token";
import { WinstonImplementationModule } from "./implementations/winston/winston.logger.module";
import { HttpLoggingInterceptor } from "./interceptors/http-logging.interceptor";
import type { LoggerConfig } from "./logger.config";

const httpLoggingInterceptorProvider: Provider = {
  provide: HTTP_LOGGING_INTERCEPTOR,
  useClass: HttpLoggingInterceptor,
};

@Global()
@Module({})
export class LoggerModule {
  static forRoot(config?: LoggerConfig): DynamicModule {
    const implModule = WinstonImplementationModule.forRoot(config);
    const loggerProvider: Provider = {
      provide: LOGGER_PROVIDER,
      useClass: LoggerProvider,
    };
    if (config && config.requestScoped) {
      loggerProvider.scope = Scope.REQUEST;
    }

    return {
      module: LoggerModule,
      imports: [implModule],
      providers: [
        { provide: LOGGER_CONFIG, useValue: config ?? {} },
        loggerProvider,
        httpLoggingInterceptorProvider,
      ],
      exports: [LOGGER_PROVIDER, LOGGER_CONFIG, HTTP_LOGGING_INTERCEPTOR],
    };
  }

  static forRootAsync(options: {
    imports?: any[];
    useFactory: (...args: any[]) => Promise<LoggerConfig> | LoggerConfig;
    inject?: any[];
  }): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        ...(options.imports || []),
        WinstonImplementationModule.forRootAsync(options),
      ],
      providers: [
        {
          provide: LOGGER_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: LOGGER_PROVIDER,
          useClass: LoggerProvider,
        },
        httpLoggingInterceptorProvider,
      ],
      exports: [LOGGER_PROVIDER, LOGGER_CONFIG, HTTP_LOGGING_INTERCEPTOR],
    };
  }
}

export { LOGGER_PROVIDER } from "./logger.token";
