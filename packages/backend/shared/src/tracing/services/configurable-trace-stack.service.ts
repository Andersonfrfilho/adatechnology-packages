import { Injectable } from '@nestjs/common';
import { context, createContextKey } from '@opentelemetry/api';
import { TracingFactoryService } from './tracing-factory.service';

const STACK_KEY = createContextKey('trace:stack');

/**
 * Versão agnóstica a fornecedor do TraceStackService
 * Funciona com qualquer provedor de tracing (OpenTelemetry, Datadog, CloudTrace, etc)
 */
@Injectable()
export class ConfigurableTraceStackService {

  constructor(private tracingFactory: TracingFactoryService) {}

  /**
   * Push method name to the call stack
   */
  push(methodName: string): void {
    const stack = this.getStack();
    const newStack = [...stack, methodName];

    // Armazenar no contexto OpenTelemetry (se disponível)
    try {
      const ctx = context.active().setValue(STACK_KEY, newStack);
      context.with(ctx, () => {
        // Context updated
      });
    } catch {
      // OpenTelemetry não disponível, apenas local
    }

    // Injetar no provedor de tracing
    this.tracingFactory.injectCallStack(newStack);
  }

  /**
   * Pop from the call stack
   */
  pop(): void {
    const stack = this.getStack();
    if (stack.length > 0) {
      const newStack = stack.slice(0, -1);

      // Armazenar no contexto OpenTelemetry
      try {
        const ctx = context.active().setValue(STACK_KEY, newStack);
        context.with(ctx, () => {
          // Context updated
        });
      } catch {
        // OpenTelemetry não disponível
      }

      // Injetar no provedor de tracing
      this.tracingFactory.injectCallStack(newStack);
    }
  }

  /**
   * Get current call stack as array
   */
  getStack(): string[] {
    try {
      const stack = context.active().getValue(STACK_KEY);
      return Array.isArray(stack) ? stack : [];
    } catch {
      // OpenTelemetry não disponível, return empty
      return [];
    }
  }

  /**
   * Get current call stack as formatted string
   * Format: [className1.method1][className2.method2]...
   */
  getStackFormatted(): string {
    const stack = this.getStack();
    if (stack.length === 0) return '';
    return stack.map((s) => `[${s}]`).join('');
  }

  /**
   * Get stack depth (number of methods in call chain)
   */
  getDepth(): number {
    return this.getStack().length;
  }

  /**
   * Get current method name (last item in stack)
   */
  getCurrentMethod(): string | null {
    const stack = this.getStack();
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }

  /**
   * Get parent method name (second to last item in stack)
   */
  getParentMethod(): string | null {
    const stack = this.getStack();
    return stack.length > 1 ? stack[stack.length - 2] : null;
  }

  /**
   * Clear the entire call stack
   */
  clear(): void {
    try {
      context.active().setValue(STACK_KEY, []);
    } catch {
      // OpenTelemetry não disponível
    }
    this.tracingFactory.injectCallStack([]);
  }
}
