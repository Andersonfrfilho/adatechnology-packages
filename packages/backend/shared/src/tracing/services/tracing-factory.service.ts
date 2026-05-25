import { Injectable } from '@nestjs/common';
import { TracingProvider } from '../interfaces/tracing-provider.interface';
import { OpenTelemetryTracingProvider } from '../implementations/opentelemetry-tracing.provider';
import { DatadogTracingProvider } from '../implementations/datadog-tracing.provider';
import { CloudTraceTracingProvider } from '../implementations/cloudtrace-tracing.provider';

/**
 * Factory para selecionar o provedor de tracing correto
 * baseado em variáveis de ambiente
 */
@Injectable()
export class TracingFactoryService {
  private provider: TracingProvider | null = null;

  /**
   * Inicializa o provedor de tracing baseado em TRACING_PROVIDER env var
   *
   * Valores suportados:
   * - "opentelemetry" (padrão) — Jaeger, CloudTrace, Honeycomb, etc
   * - "datadog" — Datadog APM
   * - "cloudtrace" — Google Cloud Trace
   * - "none" — Desabilitar tracing
   */
  async initialize(): Promise<void> {
    const tracingProvider = (process.env.TRACING_PROVIDER || 'opentelemetry').toLowerCase();

    console.log(`[TracingFactory] Initializing tracing provider: ${tracingProvider}`);

    switch (tracingProvider) {
      case 'datadog':
        this.provider = new DatadogTracingProvider();
        break;

      case 'cloudtrace':
        this.provider = new CloudTraceTracingProvider();
        break;

      case 'none':
        console.log('[TracingFactory] Tracing disabled (TRACING_PROVIDER=none)');
        this.provider = null;
        break;

      case 'opentelemetry':
      default:
        this.provider = new OpenTelemetryTracingProvider();
        break;
    }

    if (this.provider) {
      await this.provider.initialize();
    }
  }

  /**
   * Retorna o provedor de tracing ativo
   */
  getProvider(): TracingProvider | null {
    return this.provider;
  }

  /**
   * Injeta requestId no provedor de tracing
   */
  injectRequestId(requestId: string): void {
    if (this.provider) {
      this.provider.injectRequestId(requestId);
    }
  }

  /**
   * Injeta pilha de chamadas no provedor de tracing
   */
  injectCallStack(stack: string[]): void {
    if (this.provider) {
      this.provider.injectCallStack(stack);
    }
  }

  /**
   * Shutdown do provedor
   */
  async shutdown(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
    }
  }

  /**
   * Nome do provedor atual
   */
  getCurrentProviderName(): string {
    return this.provider?.getName() || 'none';
  }
}
