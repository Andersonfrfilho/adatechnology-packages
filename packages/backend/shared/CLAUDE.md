# CLAUDE.md — @adatechnology/shared

## Propósito

Biblioteca interna de tipos compartilhados, utilitários e tracing (OTel + ALS). **Não é um pacote npm independente** — é uma pasta compartilhada entre as libs do monorepo. **Nunca re-exporte a partir dela; importe diretamente.**

> ⚠️ Esta lib NÃO é publicada separadamente no npm. Importar sempre de forma direta dentro do monorepo.

## Estrutura

```
src/
├── decorators/          # @TraceMethod() para consumer services
├── errors/              # Tipos de erro compartilhados
├── interceptors/        # HttpMetricsInterceptor, etc.
├── services/            # Utilitários de serviço
├── tracing/
│   ├── decorators/
│   │   └── trace-method.decorator.ts    # @TraceMethod() — usa ALS
│   ├── implementations/                  # OTel, Datadog, CloudTrace
│   ├── interceptors/                     # ConfigurableRequestIdInterceptor
│   └── services/                         # ConfigurableTraceStackService
├── types.ts
└── index.ts
```

## @TraceMethod() Decorator

**SEMPRE usar o padrão `async/await` — nunca `.then()/.catch()`:**

```ts
// src/tracing/decorators/trace-method.decorator.ts
import { pushToTraceStack, popFromTraceStack } from '@adatechnology/logger';

export function TraceMethod() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const methodName = `${target.constructor.name}.${propertyKey}`;
    descriptor.value = async function (...args: any[]) {
      pushToTraceStack(methodName);
      try {
        return await originalMethod.apply(this, args);
      } finally {
        popFromTraceStack();
      }
    };
    return descriptor;
  };
}
```

## Onde aplicar @TraceMethod()

✅ Aplicar em:
- `async execute()` em use-cases
- Métodos de serviço que orquestram múltiplos use-cases
- Route handlers em controllers (colocar **depois** do decorator HTTP)

```ts
@Get('order/:id')
@TraceMethod()    // ← após o decorator de verbo HTTP
async getOrder(@Param('id') id: string) { ... }
```

❌ **NUNCA** aplicar em:
- Assinaturas de interface
- Métodos abstratos
- Campos de classe (`private readonly x = ...`)
- Construtores

## CRÍTICO — Regra `import type` (TS1272)

Quando `emitDecoratorMetadata: true` está habilitado (padrão nos consumer services), TypeScript emite metadata de tipo para todos os parâmetros de métodos decorados. Qualquer tipo usado como parâmetro em um método com `@TraceMethod()` **deve** usar `import type`.

```ts
// ✅ Correto
import { TraceMethod } from '@adatechnology/shared';
import { type MyParams, type MyResponse } from './my.interface';

@TraceMethod()
async execute(params: MyParams): Promise<MyResponse> { ... }

// ❌ Errado — TS1272
import { MyParams } from './my.interface';  // faltou `type`
```

**Código de erro:** `TS1272` — "A type referenced in a decorated signature must be imported with 'import type'"

## HttpMetricsInterceptor

O interceptor possui guard para contexto HTTP. Apenas aplicar em contextos que garantidamente recebem requests HTTP (não em scheduled jobs nem consumers RabbitMQ):

```ts
// Guarda interno — não falha em contextos não-HTTP
if (!ctx.switchToHttp().getRequest()) return next.handle();
```

## Dependências da lib

- `@adatechnology/logger` — para `pushToTraceStack` / `popFromTraceStack`
