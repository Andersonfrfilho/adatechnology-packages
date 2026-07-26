import { TraceStackService } from '../services/trace-stack.service'

/**
 * Decorator to automatically track method calls in the trace stack.
 * Automatically pushes method name on entry and pops on exit.
 *
 * Usage:
 *   @TraceMethod()
 *   async getUserById(userId: string) {
 *     // Stack automatically includes this method
 *   }
 *
 * The method name format will be: "ClassName.methodName"
 */
export function TraceMethod() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const className = target.constructor.name
    const methodName = `${className}.${propertyKey}`

    descriptor.value = async function (...args: any[]) {
      // Get TraceStackService from the class instance or Nest DI container
      const traceStack: TraceStackService = (this as any).traceStack || (this as any).constructor._traceStackService

      if (traceStack) {
        traceStack.push(methodName)
        try {
          return await originalMethod.apply(this, args)
        } finally {
          traceStack.pop()
        }
      } else {
        // Fallback: execute without tracing if service unavailable
        return await originalMethod.apply(this, args)
      }
    }

    return descriptor
  }
}

/**
 * Enhanced version of TraceMethod that works with services that have TraceStackService injected.
 *
 * Usage in a service:
 *   @Injectable()
 *   export class UserService {
 *     constructor(private traceStack: TraceStackService) {}
 *
 *     @TraceMethodWithDI()
 *     async getUserById(userId: string) {
 *       // Stack automatically includes this method
 *     }
 *   }
 */
export function TraceMethodWithDI() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const className = target.constructor.name
    const methodName = `${className}.${propertyKey}`

    // `this` anotado explicitamente: sem isso o TS infere o `this` do escopo externo (o
    // descriptor) e a leitura de traceStack não compila sob noImplicitThis. O decorator só é
    // válido em classe que injeta TraceStackService, e é isso que a anotação declara.
    descriptor.value = async function (this: { traceStack?: TraceStackService }, ...args: any[]) {
      const traceStack = this.traceStack

      if (traceStack) {
        traceStack.push(methodName)
        try {
          const result = originalMethod.apply(this, args)
          // Handle both sync and async returns
          if (result instanceof Promise) {
            return await result
          }
          return result
        } finally {
          traceStack.pop()
        }
      } else {
        return originalMethod.apply(this, args)
      }
    }

    return descriptor
  }
}
