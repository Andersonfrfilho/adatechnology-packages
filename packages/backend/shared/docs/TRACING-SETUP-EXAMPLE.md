# Exemplo: Como Registrar Tracing no Seu Serviço

## Option 1: Usar TracingModule (Recomendado)

Registra tudo automaticamente. Basta importar o módulo:

```typescript
// src/app.module.ts
import { TracingModule } from '@adatechnology/shared';

@Module({
  imports: [
    // ... outros imports
    ConfigModule,
    DatabaseModule,
    AuthModule,
    
    // Adicionar aqui:
    TracingModule,  // ← Tudo configurável via env vars!
  ],
})
export class AppModule {}
```

**Configuração via env:**
```bash
# Padrão (OpenTelemetry/Jaeger)
npm run start:dev

# Datadog
TRACING_PROVIDER=datadog npm run start:dev

# Google Cloud Trace
TRACING_PROVIDER=cloudtrace npm run start:dev

# Desabilitar
TRACING_PROVIDER=none npm run start:dev
```

---

## Option 2: Registrar Manualmente (Controle Total)

Se você quer customizar algo:

```typescript
// src/app.module.ts
import { Module, APP_INTERCEPTOR } from '@nestjs/core';
import {
  TracingModule,
  ConfigurableTraceStackService,
  TracingFactoryService,
} from '@adatechnology/shared';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    TracingModule,  // Importar o módulo
  ],
  providers: [
    // ... seus providers
  ],
})
export class AppModule {}
```

---

## Usar Call Stack Tracing

Simplesmente adicione o decorator:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigurableTraceStackService, TraceMethod } from '@adatechnology/shared';

@Injectable()
export class UserService {
  constructor(
    private traceStack: ConfigurableTraceStackService,
    private userRepository: UserRepository,
  ) {}

  @TraceMethod()  // ← Automático!
  async getUserById(userId: string) {
    // Stack: [UserService.getUserById]
    return await this.userRepository.findById(userId);
  }
}

@Injectable()
export class UserRepository {
  constructor(private traceStack: ConfigurableTraceStackService) {}

  @TraceMethod()
  async findById(userId: string) {
    // Stack: [UserService.getUserById][UserRepository.findById]
    return this.database.query('SELECT * FROM users WHERE id = $1', [userId]);
  }
}
```

**Resultado nos logs:**
```
[O2K2V2YH][timestamp][UserService.getUserById] - Getting user
[O2K2V2YH][timestamp][UserService.getUserById][UserRepository.findById] - Querying DB
[O2K2V2YH][timestamp][UserService.getUserById][UserRepository.findById] - Result: 1 row
[O2K2V2YH][timestamp][UserService.getUserById] - User fetched
```

---

## Usar TracingFactoryService para Lógica Customizada

Se você quer acessar o provider:

```typescript
import { Injectable } from '@nestjs/common';
import { TracingFactoryService } from '@adatechnology/shared';

@Injectable()
export class AnalyticsService {
  constructor(private tracingFactory: TracingFactoryService) {}

  async trackEvent(eventName: string, eventData: any) {
    const provider = this.tracingFactory.getProvider();
    
    if (provider) {
      const providerName = this.tracingFactory.getCurrentProviderName();
      console.log(`Tracking event "${eventName}" via ${providerName}`);
      
      // Injetar dados customizados
      if (providerName === 'opentelemetry') {
        // OpenTelemetry-specific
      } else if (providerName === 'datadog') {
        // Datadog-specific
      }
    }
  }
}
```

---

## Exemplo Completo: API Service

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@adatechnology/logger';
import { 
  ConfigurableTraceStackService, 
  TraceMethod 
} from '@adatechnology/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(LOGGER_PROVIDER) private logProvider: LoggerInterface,
    private traceStack: ConfigurableTraceStackService,
    private userService: UserService,
  ) {}

  @TraceMethod()
  async verifyEmail(email: string, code: string) {
    // Stack: [AuthService.verifyEmail]
    
    this.logProvider.info({
      message: 'Verifying email',
      context: 'AuthService.verifyEmail',
      email,
      // Opcional: incluir stack nos logs
      stack: this.traceStack.getStackFormatted(),
    });

    const user = await this.userService.findByEmail(email);
    // Stack agora: [AuthService.verifyEmail][UserService.findByEmail]

    if (!user) {
      this.logProvider.warn({
        message: 'User not found',
        email,
        stack: this.traceStack.getStackFormatted(),
      });
      throw new UserNotFoundException();
    }

    // Verificar código...
    const isValid = await this.verifyCode(user.id, code);
    // Stack agora: [AuthService.verifyEmail][AuthService.verifyCode]

    this.logProvider.info({
      message: 'Email verified successfully',
      userId: user.id,
      stack: this.traceStack.getStackFormatted(),
    });

    return { success: true, user };
  }

  @TraceMethod()
  private async verifyCode(userId: string, code: string): Promise<boolean> {
    // Stack: [AuthService.verifyEmail][AuthService.verifyCode]
    return true; // simplificado
  }
}

@Injectable()
export class UserService {
  constructor(
    private traceStack: ConfigurableTraceStackService,
    private userRepository: UserRepository,
  ) {}

  @TraceMethod()
  async findByEmail(email: string) {
    // Stack: [AuthService.verifyEmail][UserService.findByEmail]
    return await this.userRepository.findByEmail(email);
    // Stack agora: [AuthService.verifyEmail][UserService.findByEmail][UserRepository.findByEmail]
  }
}

@Injectable()
export class UserRepository {
  constructor(
    private traceStack: ConfigurableTraceStackService,
    private dataSource: DataSource,
  ) {}

  @TraceMethod()
  async findByEmail(email: string) {
    // Stack: [AuthService.verifyEmail][UserService.findByEmail][UserRepository.findByEmail]
    return this.dataSource.query('SELECT * FROM users WHERE email = $1', [email]);
  }
}
```

**Fluxo de execução com stacks:**

```
1. AuthService.verifyEmail() called
   Stack: [AuthService.verifyEmail]
   Log: "Verifying email"

2. UserService.findByEmail() called
   Stack: [AuthService.verifyEmail][UserService.findByEmail]

3. UserRepository.findByEmail() called
   Stack: [AuthService.verifyEmail][UserService.findByEmail][UserRepository.findByEmail]
   Execute SQL query
   Return result

4. UserService.findByEmail() finishes
   Stack: [AuthService.verifyEmail][UserService.findByEmail]

5. AuthService.verifyCode() called
   Stack: [AuthService.verifyEmail][AuthService.verifyCode]

6. AuthService.verifyCode() finishes
   Stack: [AuthService.verifyEmail]

7. AuthService.verifyEmail() finishes
   Stack: []
```

**Logs resultantes:**

```
[O2K2V2YH][2026-05-21T22:05:00.072Z][AuthService.verifyEmail][INFO] - Verifying email
[O2K2V2YH][2026-05-21T22:05:00.100Z][AuthService.verifyEmail][UserService.findByEmail][UserRepository.findByEmail][INFO] - Database query
[O2K2V2YH][2026-05-21T22:05:00.150Z][AuthService.verifyEmail][AuthService.verifyCode][INFO] - Verifying code
[O2K2V2YH][2026-05-21T22:05:00.200Z][AuthService.verifyEmail][INFO] - Email verified successfully
```

✅ **Perfeito!** Você pode ver exatamente qual fluxo foi seguido.

---

## Próximas Etapas

1. **Registrar TracingModule** em app.module.ts
2. **Adicionar @TraceMethod()** aos métodos principais
3. **Configurar TRACING_PROVIDER** no `.env`
4. **Testar** em dev, staging, produção
5. **Visualizar** em Jaeger/Datadog/CloudTrace

Pronto! Agora seu sistema é **agnóstico a qual solução de tracing você usa**.
