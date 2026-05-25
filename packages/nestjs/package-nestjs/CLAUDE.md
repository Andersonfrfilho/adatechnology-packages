# CLAUDE.md — @adatechnology/package-nestjs

## Propósito

Módulo compartilhado para injetar contexto do `package.json` (nome, versão) nos serviços NestJS. Base para o `PackageContextMiddleware` nos consumer services.

## Uso

```ts
import { PackageNestjsModule } from '@adatechnology/package-nestjs';

// No AppModule
imports: [PackageNestjsModule]
```

## Tokens

```ts
import { PACKAGE_NAME_TOKEN, PACKAGE_VERSION_TOKEN } from '@adatechnology/package-nestjs';

constructor(
  @Inject(PACKAGE_NAME_TOKEN) private readonly packageName: string,
  @Inject(PACKAGE_VERSION_TOKEN) private readonly packageVersion: string,
) {}
```

## Uso Principal: PackageContextMiddleware

Este módulo é usado como base para o `PackageContextMiddleware` que os consumer services implementam para inserir `projectName:version` no traceStack de cada request:

```ts
@Injectable()
export class PackageContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(PACKAGE_NAME_TOKEN) private readonly name: string,
    @Inject(PACKAGE_VERSION_TOKEN) private readonly version: string,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const requestId = req['requestId'];
    pushToTraceStack(requestId);
    pushToTraceStack(`${this.name}:${this.version}`);
    res.on('finish', () => {
      popFromTraceStack();
      popFromTraceStack();
    });
    next();
  }
}
```
