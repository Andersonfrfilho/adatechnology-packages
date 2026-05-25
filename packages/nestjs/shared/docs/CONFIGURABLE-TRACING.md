# Tracing Configurável — Agnóstico a Fornecedor

## Problema Anterior

O código estava **acoplado ao OpenTelemetry**:
```typescript
import { trace, context } from '@opentelemetry/api';  // ← Hardcoded!
span.setAttribute('request.id', requestId);
```

Se você quisesse mudar para Datadog, CloudTrace, ou outra solução, teria que refatorar tudo.

## Solução: Arquitetura Plugável

```
┌─ TracingFactory
│   ├─ Lê: TRACING_PROVIDER env var
│   ├─ Seleciona provider dinamicamente
│   └─ Expõe interface comum (injectRequestId, injectCallStack)
│
├─ ConfigurableRequestIdInterceptor (agnóstico)
├─ ConfigurableTraceStackService (agnóstico)
│
└─ Implementações específicas:
   ├─ OpenTelemetryTracingProvider (Jaeger, Honeycomb, etc)
   ├─ DatadogTracingProvider (Datadog APM)
   ├─ CloudTraceTracingProvider (Google Cloud)
   └─ Sua implementação customizada
```

## Como Usar

### Step 1: Importar TracingModule

```typescript
// src/app.module.ts
import { TracingModule } from '@adatechnology/shared';

@Module({
  imports: [
    // ... outros imports
    TracingModule,  // ← Gerencia tudo automaticamente
  ],
})
export class AppModule {}
```

### Step 2: Selecionar Provider via Env

```bash
# Padrão: OpenTelemetry (Jaeger)
npm run start:dev

# Datadog
TRACING_PROVIDER=datadog npm run start:dev

# Google Cloud Trace
TRACING_PROVIDER=cloudtrace npm run start:dev

# Desabilitar tracing
TRACING_PROVIDER=none npm run start:dev
```

### Step 3: Usar Call Stack Tracing

```typescript
import { ConfigurableTraceStackService, TraceMethod } from '@adatechnology/shared';

@Injectable()
export class UserService {
  constructor(private traceStack: ConfigurableTraceStackService) {}

  @TraceMethod()
  async getUser(userId: string) {
    // Decorador faz push/pop automaticamente
    // Funciona com qualquer provider!
    return this.userRepository.findById(userId);
  }
}
```

**Resultado:** Funciona identicamente com Jaeger, Datadog, CloudTrace, etc.

---

## Comparação de Providers

| Feature | OpenTelemetry | Datadog | CloudTrace |
|---------|---------------|---------|-----------|
| RequestId | `setAttribute` | `setTag` | `addLabel` |
| CallStack | `setAttribute` | `setTag` | `addLabel` |
| Span Events | ✅ | ✅ | ✅ |
| Auto-instrumentation | ✅ Native | ✅ Via dd-trace | ✅ Via agent |
| Cost | Gratuito | Pago | Pago |
| Self-hosted | ✅ Jaeger | ❌ | ❌ |

### Quando usar cada um?

**OpenTelemetry (Padrão)**
- 🎯 Você quer self-hosted (Jaeger local)
- 🎯 Você usa Kubernetes com Jaeger
- 🎯 Você quer flexibilidade (trocar backends depois)
- 🎯 Custo zero

**Datadog**
- 🎯 Você já usa Datadog
- 🎯 Você quer SaaS gerenciado
- 🎯 Você quer integração com logs/APM/infra da Datadog

**CloudTrace**
- 🎯 Você está em Google Cloud
- 🎯 Você quer integração nativa com GCP
- 🎯 Você quer SaaS gerenciado

---

## Criando Seu Próprio Provider

Implemente `TracingProvider`:

```typescript
import { TracingProvider } from '@adatechnology/shared';

export class MyCustomTracingProvider implements TracingProvider {
  async initialize(): Promise<void> {
    // Inicializar sua solução de tracing
    console.log('Initializing my custom tracing...');
  }

  injectRequestId(requestId: string): void {
    // Injetar requestId onde você precisa
    MyTracer.setTag('request.id', requestId);
  }

  injectCallStack(stack: string[]): void {
    // Injetar pilha de chamadas
    MyTracer.setTag('call.stack', stack);
  }

  async shutdown(): Promise<void> {
    // Cleanup
  }

  getName(): string {
    return 'my-custom-provider';
  }
}
```

Registrar no **TracingFactoryService**:

```typescript
// tracing-factory.service.ts
switch (tracingProvider) {
  case 'my-custom':
    this.provider = new MyCustomTracingProvider();
    break;
  // ... resto do código
}
```

Usar:

```bash
TRACING_PROVIDER=my-custom npm run start:dev
```

---

## Variáveis de Ambiente por Provider

### OpenTelemetry
```bash
# Já vem com auto-instrumentation
# Configuração em instrumentation.ts
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_SERVICE_NAME=api
OTEL_SDK_DISABLED=false
```

### Datadog
```bash
TRACING_PROVIDER=datadog
DD_TRACE_ENABLED=true
DD_SERVICE=api
DD_VERSION=1.0.0
DD_AGENT_HOST=localhost
DD_AGENT_PORT=8126
DD_TRACE_SAMPLE_RATE=0.1
```

### Google Cloud Trace
```bash
TRACING_PROVIDER=cloudtrace
GOOGLE_CLOUD_PROJECT=seu-projeto
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
GCP_TRACE_SAMPLE_RATE=0.1
```

---

## Exemplo Completo: Trocar de Jaeger para Datadog

**Antes (acoplado):**
1. Remover instrumentation OpenTelemetry
2. Instalar dd-trace
3. Refatorar todos os `span.setAttribute` → `span.setTag`
4. Testar tudo
5. Fazer deploy

**Agora (agnóstico):**
1. Apenas mudar env var:
   ```bash
   - TRACING_PROVIDER=opentelemetry
   + TRACING_PROVIDER=datadog
   ```
2. Instalar dd-trace se ainda não tiver
3. Deploy (sem alterar código!)

---

## Migração do Código Existente

Se você já tem código usando OpenTelemetry diretamente:

**ANTES (acoplado):**
```typescript
import { trace } from '@opentelemetry/api';

const span = trace.getActiveSpan();
span.setAttribute('user.id', userId);
span.setAttribute('request.id', requestId);
```

**DEPOIS (agnóstico):**
```typescript
import { ConfigurableTraceStackService } from '@adatechnology/shared';

constructor(private traceStack: ConfigurableTraceStackService) {}

// Para requestId (automático via interceptor)
// Não precisa fazer nada!

// Para dados customizados, use o provider:
const provider = this.tracingFactory.getProvider();
if (provider && provider.getName() === 'opentelemetry') {
  // OpenTelemetry-specific code
  const span = trace.getActiveSpan();
  span.setAttribute('user.id', userId);
}
```

Ou, melhor ainda: propague os dados via **call stack**:

```typescript
@TraceMethod()
async getUserById(userId: string) {
  // O call stack já mostra [UserService.getUserById]
  // Quer rastrear userId? Adicione em seus logs estruturados:
  this.logger.info({
    message: 'Getting user',
    userId,  // Vai pro log + tracing automaticamente
  });
}
```

---

## Verificação Pós-Deploy

### Verificar qual provider está ativo

```bash
# Verificar logs na startup
kubectl logs -f deployment/api | grep "TracingModule"
# Output: [TracingModule] Initialized with provider: datadog
```

### Verificar spans no seu provider

**Se OpenTelemetry:**
```bash
# Jaeger UI
http://jaeger.domestic.local/search
# Procurar por span.attributes.request.id = "XXX"
```

**Se Datadog:**
```bash
# Datadog APM
https://app.datadoghq.com/apm/services
# Procurar por trace com tag request.id
```

**Se CloudTrace:**
```bash
# Google Cloud Console
# Cloud Trace → Search Traces
# Filtrar por labels.request.id
```

---

## Checklist de Migração

- [ ] Adicionar `TRACING_PROVIDER=nova-solucao` ao `.env`
- [ ] Instalar dependências do novo provider se necessário
- [ ] Importar `TracingModule` em app.module.ts
- [ ] Testar localmente: `TRACING_PROVIDER=datadog npm run start:dev`
- [ ] Verificar que logs e traces aparecem no novo provider
- [ ] Atualizar documentação (alterar screenshots de Jaeger para novo provider)
- [ ] Deploy em staging
- [ ] Validar que traces aparecem no novo provider
- [ ] Deploy em produção

---

## Próximo Passo

Começar a usar:

```bash
# 1. Instalar módulo (já está no backend-package-nestjs)
npm install

# 2. Importar TracingModule no app.module.ts

# 3. Escolher provider
TRACING_PROVIDER=opentelemetry npm run start:dev

# 4. Testar: fazer requisição, verificar em Jaeger/Datadog/CloudTrace
```

Tudo pronto! Agora você pode trocar entre provedores sem alterar nenhuma linha de código de negócio.
