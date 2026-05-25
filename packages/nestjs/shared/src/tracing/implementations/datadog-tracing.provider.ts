import { Injectable } from '@nestjs/common';
import { TracingProvider } from '../interfaces/tracing-provider.interface';

/**
 * Implementação de tracing usando Datadog APM
 *
 * Requer: npm install dd-trace
 *
 * Configuração via env:
 * - DD_TRACE_ENABLED=true
 * - DD_SERVICE=api
 * - DD_VERSION=1.0.0
 * - DD_AGENT_HOST=localhost
 * - DD_AGENT_PORT=8126
 */
@Injectable()
export class DatadogTracingProvider implements TracingProvider {
  private tracer: any;

  async initialize(): Promise<void> {
    try {
      // Lazy import para não quebrar se dd-trace não está instalado
      const ddTrace = require('dd-trace');
      this.tracer = ddTrace.init();
      console.log('[DatadogTracingProvider] Initialized');
    } catch (error) {
      console.warn('[DatadogTracingProvider] dd-trace not available:', error.message);
    }
  }

  injectRequestId(requestId: string): void {
    if (!this.tracer) return;

    const span = this.tracer.scope().active();
    if (span) {
      span.setTag('request.id', requestId);
      span.setTag('correlation.id', requestId);
    }
  }

  injectCallStack(stack: string[]): void {
    if (!this.tracer) return;

    const span = this.tracer.scope().active();
    if (span) {
      span.setTag('trace.stack', stack);
      span.setTag('trace.stack.formatted', stack.map((s) => `[${s}]`).join(''));
      span.setTag('trace.depth', stack.length);
    }
  }

  async shutdown(): Promise<void> {
    if (this.tracer && this.tracer.shutdown) {
      return new Promise((resolve) => {
        this.tracer.shutdown(() => resolve());
      });
    }
  }

  getName(): string {
    return 'datadog';
  }
}
