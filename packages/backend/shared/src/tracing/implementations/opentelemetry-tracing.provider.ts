import { Injectable } from '@nestjs/common';
import { trace, context, createContextKey } from '@opentelemetry/api';
import { TracingProvider } from '../interfaces/tracing-provider.interface';

const REQUEST_ID_KEY = createContextKey('request.id');
const CORRELATION_ID_KEY = createContextKey('correlation.id');

/**
 * Implementação de tracing usando OpenTelemetry (Jaeger, CloudTrace, etc)
 */
@Injectable()
export class OpenTelemetryTracingProvider implements TracingProvider {
  async initialize(): Promise<void> {
    // OpenTelemetry é inicializado globalmente em main.ts/instrumentation.ts
    // Aqui apenas validamos se está disponível
    if (!trace.getActiveSpan) {
      console.warn('[OpenTelemetryTracingProvider] OpenTelemetry not initialized');
    }
  }

  injectRequestId(requestId: string): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute('request.id', requestId);
      span.setAttribute('correlation.id', requestId);
    }

    // Propagar via contexto para bibliotecas externas
    const ctx = context.active()
      .setValue(REQUEST_ID_KEY, requestId)
      .setValue(CORRELATION_ID_KEY, requestId);
    context.with(ctx, () => {
      // Context propagated
    });
  }

  injectCallStack(stack: string[]): void {
    const span = trace.getActiveSpan();
    if (span) {
      // Injetar como array e como string formatada
      span.setAttribute('trace.stack', stack);
      span.setAttribute('trace.stack.formatted', stack.map((s) => `[${s}]`).join(''));
      span.setAttribute('trace.depth', stack.length);
    }
  }

  async shutdown(): Promise<void> {
    // OpenTelemetry cleanup is handled by auto-instrumentation
  }

  getName(): string {
    return 'opentelemetry';
  }
}
