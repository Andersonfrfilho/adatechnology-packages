import { Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TracingFactoryService } from './services/tracing-factory.service';
import { ConfigurableTraceStackService } from './services/configurable-trace-stack.service';
import { TraceStackInterceptor } from './interceptors/trace-stack.interceptor';
import { ConfigurableRequestIdInterceptor } from './interceptors/configurable-request-id.interceptor';
import { OpenTelemetryTracingProvider } from './implementations/opentelemetry-tracing.provider';
import { DatadogTracingProvider } from './implementations/datadog-tracing.provider';
import { CloudTraceTracingProvider } from './implementations/cloudtrace-tracing.provider';

/**
 * Módulo de Tracing Configurável
 *
 * Seleciona o provedor de tracing via env var: TRACING_PROVIDER
 *
 * Exemplos:
 * ```bash
 * # Usar OpenTelemetry (Jaeger)
 * TRACING_PROVIDER=opentelemetry npm run start:dev
 *
 * # Usar Datadog
 * TRACING_PROVIDER=datadog npm run start:dev
 *
 * # Usar Google Cloud Trace
 * TRACING_PROVIDER=cloudtrace npm run start:dev
 *
 * # Desabilitar tracing
 * TRACING_PROVIDER=none npm run start:dev
 * ```
 *
 * Exporta:
 * - TracingFactoryService
 * - ConfigurableTraceStackService
 * - Interceptadores automáticos registrados
 */
@Module({
  providers: [
    TracingFactoryService,
    ConfigurableTraceStackService,
    OpenTelemetryTracingProvider,
    DatadogTracingProvider,
    CloudTraceTracingProvider,
    {
      provide: APP_INTERCEPTOR,
      useClass: TraceStackInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ConfigurableRequestIdInterceptor,
    },
  ],
  exports: [TracingFactoryService, ConfigurableTraceStackService],
})
export class TracingModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(private tracingFactory: TracingFactoryService) {}

  async onApplicationBootstrap() {
    await this.tracingFactory.initialize();
    console.log(`[TracingModule] Initialized with provider: ${this.tracingFactory.getCurrentProviderName()}`);
  }

  async onApplicationShutdown(signal?: string) {
    console.log(`[TracingModule] Shutting down tracing (signal: ${signal})`);
    await this.tracingFactory.shutdown();
  }
}
