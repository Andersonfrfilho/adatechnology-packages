/**
 * Decorator para rastrear chamadas de métodos automaticamente
 * Funciona com qualquer provedor de tracing (agnóstico a fornecedor)
 *
 * Uso:
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   constructor(private traceStack: ConfigurableTraceStackService) {}
 *
 *   @TraceMethod()
 *   async myMethod() {
 *     // Stack automatically tracked on entry/exit
 *   }
 * }
 * ```
 */

let loggerHelpersLoaded = false;
let pushToTraceStack: ((method: string) => void) | null = null;
let popFromTraceStack: (() => void) | null = null;

function loadLoggerHelpersSync() {
  if (loggerHelpersLoaded) {
    return;
  }
  loggerHelpersLoaded = true;
  try {
    // Require at runtime to avoid TypeScript compilation issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const logger = require("@adatechnology/logger");
    pushToTraceStack = logger?.pushToTraceStack || null;
    popFromTraceStack = logger?.popFromTraceStack || null;
  } catch {
    // Logger not available, continue with ConfigurableTraceStackService only
  }
}

export function TraceMethod() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = `${className}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      // Load logger helpers on first method call
      loadLoggerHelpersSync();

      const traceStack = (this as any).traceStack;
      const hasALS = pushToTraceStack !== null && popFromTraceStack !== null;

      if (hasALS) {
        pushToTraceStack!(methodName);
      }

      if (traceStack) {
        traceStack.push(methodName);
      }

      try {
        const result = originalMethod.apply(this, args);
        if (result instanceof Promise) {
          return await result;
        }
        return result;
      } finally {
        if (hasALS) {
          popFromTraceStack!();
        }
        if (traceStack) {
          traceStack.pop();
        }
      }
    };

    return descriptor;
  };
}

/**
 * Alias para compatibilidade com código existente
 */
export const TraceMethodWithDI = TraceMethod;
