# Tracing Tests — Exemplo de Teste da Arquitetura Configurável

## Como Executar

```bash
# 1. Ir para o diretório do exemplo
cd packages/shared && cd ../../example

# 2. Instalar dependências
npm install

# 3. Executar com tracing OpenTelemetry (padrão)
npm run start:dev

# Ou executar com diferentes provedores
TRACING_PROVIDER=opentelemetry npm run start:dev
TRACING_PROVIDER=datadog npm run start:dev
TRACING_PROVIDER=cloudtrace npm run start:dev
TRACING_PROVIDER=none npm run start:dev
```

## Endpoints para Testar

### 1. Verificar Status do Tracing

```bash
curl http://localhost:3000/tracing/status
```

**Resposta esperada:**
```json
{
  "message": "Tracing Status",
  "provider": "opentelemetry",
  "requestId": "O2K2V2YH",
  "availableProviders": ["opentelemetry", "datadog", "cloudtrace", "none"],
  "instructions": "Set TRACING_PROVIDER env var to switch providers"
}
```

### 2. Testar Call Stack Rastreamento

```bash
curl http://localhost:3000/tracing/order/ORDER-123
```

**Resposta esperada:**
```json
{
  "message": "Order processed with call stack tracing",
  "requestId": "O2K2V2YH",
  "provider": "opentelemetry",
  "result": {
    "orderId": "ORDER-123",
    "customer": {
      "customerId": "customer-ORDER-123",
      "name": "John Doe"
    }
  },
  "testDetails": {
    "orderId": "ORDER-123",
    "stackTracked": true,
    "decoratorsUsed": 3,
    "callDepthObserved": "TracingDemoController.processOrder → TracingDemoService.processOrder → getCustomerForOrder → getCustomerId"
  }
}
```

**Logs esperados no console:**
```
=== TRACING TEST START ===
Request ID: O2K2V2YH
Provider: opentelemetry
Initial stack: ""
[TracingDemo] Call stack: [TracingDemoService.processOrder]
[TracingDemo] Depth: 1
[TracingDemo] Call stack: [TracingDemoService.processOrder][TracingDemoService.getCustomerForOrder]
[TracingDemo] Depth: 2
[TracingDemo] Call stack: [TracingDemoService.processOrder][TracingDemoService.getCustomerForOrder][TracingDemoService.getCustomerId]
[TracingDemo] Depth: 3
[TracingDemo] Current method: TracingDemoService.getCustomerId
[TracingDemo] Parent method: TracingDemoService.getCustomerForOrder
Final stack: ""
=== TRACING TEST END ===
```

### 3. Testar Stack Vazio (sem decoradores)

```bash
curl http://localhost:3000/tracing/test-empty-stack
```

**Logs esperados:**
```
=== EMPTY STACK TEST ===
[TracingDemo] Stack when no decorator: ""
[TracingDemo] Should be empty: "true"
=== TEST END ===
```

---

## Testes por Provider

### OpenTelemetry (Jaeger)

```bash
TRACING_PROVIDER=opentelemetry npm run start:dev

# No outro terminal
curl http://localhost:3000/tracing/status
# Verifica que provider = "opentelemetry"

curl http://localhost:3000/tracing/order/TEST-001
# Verifica que call stack é rastreado

# Se tiver Jaeger rodando (docker run -p 16686:16686 jaegertracing/all-in-one)
# Ir para http://localhost:16686 e procurar by service "example"
# Verificar que span tem atributo request.id = "O2K2V2YH"
```

### Datadog

```bash
# Instalar dd-trace
npm install dd-trace

# Rodar
TRACING_PROVIDER=datadog npm run start:dev

# No outro terminal
curl http://localhost:3000/tracing/status
# Verifica que provider = "datadog"

curl http://localhost:3000/tracing/order/TEST-002
# Verifica que call stack é rastreado

# Se tiver Datadog agent rodando
# Verificar em Datadog APM que trace tem tag request.id
```

### Google Cloud Trace

```bash
# Configurar credentials
export GOOGLE_CLOUD_PROJECT=seu-projeto
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# Instalar Google Cloud Trace
npm install @google-cloud/trace-agent

# Rodar
TRACING_PROVIDER=cloudtrace npm run start:dev

# No outro terminal
curl http://localhost:3000/tracing/status
# Verifica que provider = "cloudtrace"

curl http://localhost:3000/tracing/order/TEST-003
# Verifica que call stack é rastreado

# Se tiver GCP rodando
# Verificar em Cloud Console > Cloud Trace que trace tem label request.id
```

### Desabilitar Tracing

```bash
TRACING_PROVIDER=none npm run start:dev

curl http://localhost:3000/tracing/status
# Verifica que provider = "none"

curl http://localhost:3000/tracing/order/TEST-004
# Funciona normalmente mas sem tracing
```

---

## Verificação Checklist

### ✅ Call Stack Tracing

- [ ] Stack começa vazio no início da requisição
- [ ] Stack cresce conforme métodos com `@TraceMethod()` são chamados
- [ ] Stack mostra ordem correta: [Method1][Method2][Method3]...
- [ ] Stack diminui conforme métodos saem
- [ ] Stack termina vazio no final

### ✅ RequestId Propagation

- [ ] Cada requisição HTTP recebe um requestId único
- [ ] RequestId aparece em todas as respostas
- [ ] RequestId é diferente entre requisições diferentes

### ✅ Provider Selection

- [ ] OpenTelemetry: provider = "opentelemetry" (padrão)
- [ ] Datadog: provider = "datadog" quando TRACING_PROVIDER=datadog
- [ ] CloudTrace: provider = "cloudtrace" quando TRACING_PROVIDER=cloudtrace
- [ ] None: provider = "none" quando TRACING_PROVIDER=none

### ✅ Span Attributes (OpenTelemetry only)

Se tiver Jaeger rodando:
- [ ] Span contém atributo `request.id`
- [ ] Span contém atributo `trace.stack` (array de métodos)
- [ ] Span contém atributo `trace.stack.formatted` (string formatada)
- [ ] Span contém atributo `trace.depth` (número de métodos)

---

## Troubleshooting

### Provider não é reconhecido

```bash
# Verificar que TRACING_PROVIDER está correto
echo $TRACING_PROVIDER

# Deve estar entre: opentelemetry, datadog, cloudtrace, none
```

### Call stack não funciona

```bash
# Verificar que @TraceMethod() decorator está importado
grep "TraceMethod" src/tracing-demo/tracing-demo.service.ts

# Verificar que ConfigurableTraceStackService está injetado
grep "traceStack:" src/tracing-demo/tracing-demo.service.ts
```

### Span attributes não aparecem em Jaeger

```bash
# Verificar que Jaeger está rodando
curl http://localhost:16686/api/services
# Deve listar "example" como serviço

# Verificar que OTEL_EXPORTER_OTLP_ENDPOINT está correto
echo $OTEL_EXPORTER_OTLP_ENDPOINT
# Padrão: http://localhost:4318
```

---

## Próximos Passos Após Validar

1. ✅ Validar que exemplo funciona com todos os providers
2. ✅ Validar que call stack é rastreado corretamente
3. ✅ Copiar arquivos para os 4 serviços (API, BFF, Worker, Cron)
4. ✅ Testar em cada serviço
5. ✅ Implementar propagação de requestId entre serviços
6. ✅ Deploy em staging/produção
