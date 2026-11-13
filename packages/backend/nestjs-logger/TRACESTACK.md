# TraceStack - Complete Call Hierarchy Logging

## Overview

TraceStack é um sistema de logging que mostra a **hierarquia completa de execução** de uma requisição, do endpoint até o ponto onde o log foi gerado. Permite rastreamento end-to-end de chamadas de métodos em toda a aplicação.

## Log Format

```
[requestId][timestamp][projectName:version][Class1.method1][Class2.method2][...][LEVEL] - message
```

### Exemplo Real

```
[4bf615d1-ca3c-48be-832f-9fd021f9fde8][2026-05-23T23:20:51.950Z][api:0.0.1][UserController.create][UserService.create][UserRepository.save][INFO] - User created successfully
```

**Breakdown:**
- `[4bf615d1-ca3c-48be-832f-9fd021f9fde8]` — Request ID único da requisição
- `[2026-05-23T23:20:51.950Z]` — Timestamp ISO
- `[api:0.0.1]` — Project name:version (lido de package.json)
- `[UserController.create]` — Método do controller (entrada HTTP)
- `[UserService.create]` — Método do service
- `[UserRepository.save]` — Método do repository
- `[INFO]` — Log level
- `User created successfully` — Mensagem

## Como Funciona

### 1. AsyncLocalStorage (ALS)

O trace stack é armazenado em AsyncLocalStorage, não em variáveis globais. Isso garante isolamento perfeito entre requisições concorrentes.

```ts
// src/context/async-context.service.ts
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getTraceStack(): string[] {
  const context = asyncLocalStorage.getStore();
  return context?.traceStack ?? [];
}

export function pushToTraceStack(method: string): void {
  const context = asyncLocalStorage.getStore();
  if (context) {
    context.traceStack.push(method);
  }
}
```

### 2. Fluxo de Uma Requisição

#### Passo 1: RequestContextMiddleware (da lib logger)

```ts
// Middleware do framework NestJS que já está no projeto
// Gera requestId e cria AsyncLocalStorage context

RequestContextMiddleware:
  req.requestId = generateRequestId()  // "4bf615d1-ca3c-48be-..."
  asyncLocalStorage.run({ requestId, traceStack: [] }, () => next())
```

#### Passo 2: PackageContextMiddleware (do seu serviço)

```ts
// src/shared/middleware/package-context.middleware.ts
PackageContextMiddleware:
  const requestId = req.requestId
  const projectLabel = `${name}:${version}`  // "api:0.0.1"
  
  pushToTraceStack(requestId)          // [4bf615d1-...]
  pushToTraceStack(projectLabel)       // [4bf615d1-...][api:0.0.1]
  
  res.on('finish', () => {
    popFromTraceStack()  // Remove projectLabel
    popFromTraceStack()  // Remove requestId
  })
```

#### Passo 3: Controller Execution

```ts
// src/modules/user/user.controller.ts
@Controller('users')
export class UserController {
  @Post()
  @TraceMethod()  // Decorator auto-rastreia
  async create(@Body() dto: CreateUserDto) {
    // Neste ponto, trace stack = [4bf615d1-...][api:0.0.1][UserController.create]
    await this.userService.create(dto);
  }
}

// O @TraceMethod() faz isto automaticamente:
// pushToTraceStack('UserController.create')
// try {
//   return await originalMethod.apply(this, args)
// } finally {
//   popFromTraceStack()
// }
```

#### Passo 4: Service Execution

```ts
// src/modules/user/user.service.ts
@Injectable()
export class UserService {
  @TraceMethod()
  async create(dto: CreateUserDto) {
    // Trace stack = [4bf615d1-...][api:0.0.1][UserController.create][UserService.create]
    
    this.logger.info({
      message: 'Creating user',
      context: `${this.constructor.name}.create`,
      meta: { email: dto.email }
    });
    
    // Log output:
    // [4bf615d1-...][2026-05-23T23:20:51.950Z][api:0.0.1][UserController.create][UserService.create][INFO] - Creating user
    
    await this.userRepository.save(dto);
  }
}
```

#### Passo 5: Repository Execution

```ts
// src/modules/user/user.repository.ts
@Injectable()
export class UserRepository {
  @TraceMethod()
  async save(user: User) {
    // Trace stack = [4bf615d1-...][api:0.0.1][UserController.create][UserService.create][UserRepository.save]
    
    return await this.dataSource.manager.save(user);
  }
}
```

#### Passo 6: Log Emitted

```ts
// Quando this.logger.info() é chamado em UserService.create()
LOGGER_PROVIDER.info({
  message: 'User created',
  context: 'UserService.create',
  meta: { userId: user.id }
});

// O LoggerProvider:
// 1. Lê trace stack do AsyncLocalStorage
// 2. Formata: [requestId][timestamp][...traceStack...][LEVEL] - message
// 3. Escreve no console e/ou arquivo
```

## Componentes

### 1. TraceMethod Decorator

**Arquivo:** `src/shared/decorators/trace-method.decorator.ts`

```ts
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

**Uso:**
```ts
@Injectable()
export class MyService {
  @TraceMethod()
  async myMethod() {
    // Automaticamente rastreado
  }
}
```

**Importante:** No controller, `@TraceMethod()` deve estar ABAIXO de `@Get/@Post/@Put/@Delete`:
```ts
@Post('users')
@TraceMethod()  // ← Deve estar abaixo
async create() { }
```

### 2. PackageContextMiddleware

**Arquivo:** `src/shared/middleware/package-context.middleware.ts`

Middleware que injeta `[requestId]` e `[projectName:version]` no início de cada requisição.

```ts
@Injectable()
export class PackageContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req as any).requestId;  // Set by RequestContextMiddleware
    const { name, version } = getPackageInfo();
    const projectLabel = `${name}:${version}`;

    // Push em ordem: requestId → projectLabel
    if (requestId) {
      pushToTraceStack(requestId);
    }
    pushToTraceStack(projectLabel);

    // Pop em ordem inversa (LIFO)
    res.on('finish', () => {
      popFromTraceStack();  // projectLabel
      if (requestId) {
        popFromTraceStack();  // requestId
      }
    });

    next();
  }
}
```

**Registro no app.module.ts:**
```ts
consumer.apply(RequestContextMiddleware, PackageContextMiddleware).forRoutes('*');
```

### 3. Logger Configuration

**Em app.module.ts:**
```ts
LoggerModule.forRoot({
  enableTraceStack: true,  // ← Ativa o TraceStack
  level: 'info',
  fileTransport: {
    enabled: true,
    dir: 'logs',
    filename: 'app-%DATE%.log'
  }
})
```

## Adicionando @TraceMethod a Métodos

### Nas Use Cases

```ts
@Injectable()
export class CreateUserUseCase {
  @TraceMethod()
  async execute(dto: CreateUserDto): Promise<User> {
    // Rastreado automaticamente
    return await this.userRepository.save(dto);
  }
}
```

### Nos Services

```ts
@Injectable()
export class UserService {
  @TraceMethod()
  async create(dto: CreateUserDto) {
    // Rastreado
  }

  @TraceMethod()
  async findById(id: string) {
    // Rastreado
  }
}
```

### Nos Repositories

```ts
@Injectable()
export class UserRepository {
  @TraceMethod()
  async save(user: User) {
    // Rastreado
  }

  @TraceMethod()
  async findOne(id: string) {
    // Rastreado
  }
}
```

## Exemplo Completo: Fluxo de Criação de Usuário

### Requisição
```bash
POST /users HTTP/1.1
Content-Type: application/json

{ "email": "user@example.com", "name": "John Doe" }
```

### Código
```ts
// Controller
@Controller('users')
export class UserController {
  constructor(private createUserUseCase: CreateUserUseCase) {}

  @Post()
  @TraceMethod()
  async create(@Body() dto: CreateUserDto) {
    return await this.createUserUseCase.execute(dto);
  }
}

// Use Case
@Injectable()
export class CreateUserUseCase {
  constructor(private userService: UserService) {}

  @TraceMethod()
  async execute(dto: CreateUserDto) {
    return await this.userService.create(dto);
  }
}

// Service
@Injectable()
export class UserService {
  constructor(private userRepository: UserRepository) {}

  @TraceMethod()
  async create(dto: CreateUserDto) {
    const user = new User(dto);
    this.logger.info({
      message: 'Creating user',
      context: `${this.constructor.name}.create`,
      meta: { email: dto.email }
    });
    return await this.userRepository.save(user);
  }
}

// Repository
@Injectable()
export class UserRepository {
  constructor(private dataSource: DataSource) {}

  @TraceMethod()
  async save(user: User) {
    return await this.dataSource.manager.save(user);
  }
}
```

### Trace Stack Evolution

```
1. Request arrives
   Stack: []

2. RequestContextMiddleware
   Stack: ["d951982e-9662-44ed-b637-f60d751dffc7"]

3. PackageContextMiddleware  
   Stack: ["d951982e-9662-44ed-b637-f60d751dffc7", "api:0.0.1"]

4. UserController.create() → @TraceMethod()
   Stack: [..., "UserController.create"]

5. CreateUserUseCase.execute() → @TraceMethod()
   Stack: [..., "UserController.create", "CreateUserUseCase.execute"]

6. UserService.create() → @TraceMethod()
   Stack: [..., "UserController.create", "CreateUserUseCase.execute", "UserService.create"]
   
   Logger.info() called here:
   [d951982e-...][2026-05-24T10:30:15.123Z][api:0.0.1][UserController.create][CreateUserUseCase.execute][UserService.create][INFO] - Creating user

7. UserRepository.save() → @TraceMethod()
   Stack: [..., "UserController.create", "CreateUserUseCase.execute", "UserService.create", "UserRepository.save"]

8. Response finish → PackageContextMiddleware
   Stack: []  (cleaned up LIFO)
```

## Best Practices

### ✅ DO

- ✅ Use `@TraceMethod()` em **public** methods de controllers, services, use cases, repositories
- ✅ Coloque `@TraceMethod()` **abaixo** de `@Get/@Post/@Put/@Delete` decorators
- ✅ Use trace stack para debugar fluxos complexos
- ✅ Combine com structured logging para rastreabilidade completa

### ❌ DON'T

- ❌ Não use `@TraceMethod()` em getters/setters simples
- ❌ Não use em métodos chamados milhões de vezes (loops internos)
- ❌ Não coloque `@TraceMethod()` **acima** de route decorators
- ❌ Não use console.log — sempre use LOGGER_PROVIDER

## Monitoramento e Debugging

Com TraceStack ativado, consegue-se:

### Performance Analysis
```
[req-id][timestamp][app:1.0.0][Controller.method][Service.slow_method][DB.query][DEBUG] - 450ms elapsed
```
Identifica onde o tempo está sendo gasto.

### Error Tracing
```
[req-id][timestamp][app:1.0.0][Controller.create][Service.validate][ERROR] - Validation failed
```
Mostra exatamente em que ponto da execução o erro ocorreu.

### Dependency Discovery
```
[req-id][timestamp][app:1.0.0][Controller][Service][Cache.get][INFO] - Cache hit
[req-id][timestamp][app:1.0.0][Controller][Service][HTTP.get][INFO] - External API called
```
Mostra que dependências estão sendo usadas.

## Troubleshooting

### Trace stack vazio

**Causa:** `enableTraceStack: false` ou middleware não registrado

**Fix:**
```ts
LoggerModule.forRoot({
  enableTraceStack: true  // ← Ativar
})

// E verificar app.module.ts:
consumer.apply(RequestContextMiddleware, PackageContextMiddleware).forRoutes('*');
```

### RequestId undefined

**Causa:** RequestContextMiddleware não está rodando antes de PackageContextMiddleware

**Fix:**
```ts
// A ordem importa!
consumer.apply(
  RequestContextMiddleware,      // ← Primeiro
  PackageContextMiddleware       // ← Depois
).forRoutes('*');
```

### Métodos não aparecem na stack

**Causa:** @TraceMethod não foi aplicado ou está na ordem errada

**Fix:**
```ts
// ERRADO
@TraceMethod()
@Get('endpoint')
async method() { }

// CORRETO
@Get('endpoint')
@TraceMethod()
async method() { }
```

## Relacionados

- [[tracestack-implemented-complete]] — Status atual de implementação em todos os 4 serviços
- [[tracestack-complete-implementation]] — Plano original da implementação
