import { DynamicModule, Module, Provider, Global } from "@nestjs/common";
import { ExampleService } from "./shared.service";
import type { ExampleOptions, ExampleServiceInterface } from "./types";
import {
  EXAMPLE_OPTIONS_TOKEN,
  EXAMPLE_SERVICE_PROVIDE,
  createExampleOptionsToken,
  createExampleServiceToken,
} from "./tokens";

@Global()
@Module({})
export class ExampleModule {
  static forRoot(options?: ExampleOptions): DynamicModule {
    console.log("[ExampleModule.forRoot] options:", options);
    const opts: Provider = {
      provide: EXAMPLE_OPTIONS_TOKEN,
      useValue: options ?? {},
    };

    return {
      module: ExampleModule,
      global: true,
      providers: [
        // options provider required by ExampleService
        opts,
        // ensure the service is constructed with the options from the token
        {
          provide: EXAMPLE_SERVICE_PROVIDE,
          useFactory: (sOptions: ExampleOptions) =>
            new ExampleService(sOptions),
          inject: [EXAMPLE_OPTIONS_TOKEN],
        },
      ],
      exports: [EXAMPLE_SERVICE_PROVIDE],
    };
  }

  // register a named instance (per-feature) using dynamic tokens
  static register(name: string, options?: ExampleOptions): DynamicModule {
    const optionsToken = createExampleOptionsToken(name);
    const serviceToken = createExampleServiceToken(name);

    const opts: Provider = {
      provide: optionsToken,
      useValue: options ?? {},
    };

    return {
      module: ExampleModule,
      providers: [
        opts,
        {
          provide: serviceToken,
          useFactory: (sOptions: ExampleOptions) =>
            new ExampleService(sOptions),
          inject: [optionsToken],
        },
      ],
      exports: [serviceToken],
    };
  }

  // async configuration for root
  static forRootAsync(opts: {
    useFactory: (...args: any[]) => Promise<ExampleOptions> | ExampleOptions;
    inject?: any[];
  }): DynamicModule {
    const optionsProvider: Provider = {
      provide: EXAMPLE_OPTIONS_TOKEN,
      useFactory: opts.useFactory,
      inject: opts.inject || [],
    };

    return {
      module: ExampleModule,
      global: true,
      providers: [
        optionsProvider,
        {
          provide: EXAMPLE_SERVICE_PROVIDE,
          useFactory: (sOptions: ExampleOptions) =>
            new ExampleService(sOptions),
          inject: [EXAMPLE_OPTIONS_TOKEN],
        },
      ],
      exports: [EXAMPLE_SERVICE_PROVIDE],
    };
  }
}
