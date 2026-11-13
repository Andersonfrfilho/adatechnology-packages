# CLAUDE.md — @adatechnology/logger

## Propósito

Logger estruturado com Winston, AsyncLocalStorage (ALS) para contexto por request, e TraceStack opcional para rastrear hierarquia de chamadas.

## Estrutura

```
src/
├── context/
│   ├── async-context.service.ts   # ALS: getContext, runWithContext, push/popFromTraceStack
│   └── async-context.types.ts     # RequestContext: { requestId, traceStack }
├── implementations/winston/        # Winston logger + DailyRotateFile transport
├── interceptors/                   # HttpLoggingInterceptor, ExcludeHttpLogging
├── middleware/                     # RequestContextMiddleware
├── logger.config.ts                # LoggerConfig interface
├── logger.module.ts                # LoggerModule.forRoot()
├── logger.provider.ts              # LoggerProvider implementando LoggerProviderInterface
└── index.ts                        # Re-exports públicos
```

## Exports Principais

```ts
// Módulo
export { LoggerModule } from './logger.module';

// Token de injeção
export { LOGGER_PROVIDER } from './logger.token';

// Middleware (adicionar em AppModule)
export { RequestContextMiddleware } from './middleware/request-context.middleware';

// TraceStack helpers (usar em @TraceMethod e PackageContextMiddleware)
export { getTraceStack, pushToTraceStack, popFromTraceStack } from './context/async-context.service';

// Config
export type { LoggerConfig } from './logger.config';
```

## LoggerConfig

```ts
LoggerModule.forRoot({
  level: 'debug',           // 'debug' | 'info' | 'warn' | 'error'
  isProduction: false,      // true → JSON, false → colorized text
  colorize: true,
  enableTraceStack: true,   // inclui hierarquia de chamadas no log
  fileTransport: {          // opcional — file transport para dev/prod
    enabled: true,
    dir: 'logs',
    filename: 'app-%DATE%.log',
    maxSize: '20m',
    maxFiles: '14d',
  },
})
```

**NUNCA** passe `appName`/`appVersion` — o `PackageContextMiddleware` lê isso do `package.json` e insere no traceStack.

## Formato do Log

**Com `enableTraceStack: false` (default):**
```
[requestId][timestamp][Class.method][LEVEL] - message
```

**Com `enableTraceStack: true`:**
```
[requestId][timestamp][Class1.method1][Class2.method2][LibClass.method][LEVEL] - message
```

Exemplo real:
```
[4bf615d1][2026-05-23T23:20:51.950Z][example:0.0.3][Controller.create][Service.create][INFO] - Created
```

## TraceStack — Como funciona

O `pushToTraceStack` / `popFromTraceStack` usa ALS para adicionar/remover entradas da stack por contexto de request, sem risco de vazamento entre requests concorrentes.

```ts
import { pushToTraceStack, popFromTraceStack } from '@adatechnology/logger';

// No @TraceMethod():
pushToTraceStack(`${ClassName}.${methodName}`);
try {
  return await originalMethod.apply(this, args);
} finally {
  popFromTraceStack();
}
```

## Middleware de Contexto (PackageContextMiddleware)

Para inserir `requestId` e `projectName:version` no início de cada trace stack, o consumer deve ter um `PackageContextMiddleware` próprio:

```ts
// src/shared/middleware/package-context.middleware.ts
import { pushToTraceStack, popFromTraceStack } from '@adatechnology/logger';

@Injectable()
export class PackageContextMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const requestId = req['requestId'];
    const { name, version } = require('../../../package.json');

    pushToTraceStack(requestId);
    pushToTraceStack(`${name}:${version}`);

    res.on('finish', () => {
      popFromTraceStack(); // projectName:version
      popFromTraceStack(); // requestId
    });

    next();
  }
}
```

## Adicionando à lib

Quando novos helpers são adicionados ao ALS ou ao logger, exportar sempre de `src/index.ts`. Bump de versão obrigatório + changeset.

## Build e Publish

```bash
pnpm run build:libs-ordered   # build de todas as libs em ordem
pnpm changeset                # registrar mudança
pnpm changeset version        # bump version
pnpm changeset publish        # publicar no npm
```
