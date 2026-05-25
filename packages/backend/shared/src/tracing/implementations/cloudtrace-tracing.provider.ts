import { Injectable } from '@nestjs/common';
import { TracingProvider } from '../interfaces/tracing-provider.interface';

/**
 * Implementação de tracing usando Google Cloud Trace
 *
 * Requer: npm install @google-cloud/trace-agent
 *
 * Configuração via env:
 * - GOOGLE_CLOUD_PROJECT=seu-projeto
 * - GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
 */
@Injectable()
export class CloudTraceTracingProvider implements TracingProvider {
  private traceAgent: any;
  private span: any;

  async initialize(): Promise<void> {
    try {
      // Lazy import para não quebrar se Google Cloud Trace não está instalado
      this.traceAgent = require('@google-cloud/trace-agent');

      const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
      if (!projectId) {
        console.warn('[CloudTraceTracingProvider] GOOGLE_CLOUD_PROJECT not set');
        return;
      }

      this.traceAgent.start({
        projectId,
        samplingRate: Number(process.env.GCP_TRACE_SAMPLE_RATE) || 0.1,
      });

      console.log('[CloudTraceTracingProvider] Initialized for project:', projectId);
    } catch (error) {
      console.warn('[CloudTraceTracingProvider] @google-cloud/trace-agent not available:', error.message);
    }
  }

  injectRequestId(requestId: string): void {
    if (!this.traceAgent || !this.traceAgent.getCurrentRootSpan) return;

    const span = this.traceAgent.getCurrentRootSpan();
    if (span) {
      span.addLabel('request.id', requestId);
      span.addLabel('correlation.id', requestId);
    }
  }

  injectCallStack(stack: string[]): void {
    if (!this.traceAgent || !this.traceAgent.getCurrentRootSpan) return;

    const span = this.traceAgent.getCurrentRootSpan();
    if (span) {
      span.addLabel('trace.stack', JSON.stringify(stack));
      span.addLabel('trace.stack.formatted', stack.map((s) => `[${s}]`).join(''));
      span.addLabel('trace.depth', String(stack.length));
    }
  }

  async shutdown(): Promise<void> {
    if (this.traceAgent && this.traceAgent.stop) {
      this.traceAgent.stop();
    }
  }

  getName(): string {
    return 'cloudtrace';
  }
}
