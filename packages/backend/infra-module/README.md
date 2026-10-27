# @adatechnology/infra-module

Gestão de infraestrutura Railway como módulo plugável: inventário de projetos e ambientes, ligar e
desligar com ordem (bancos primeiro), agenda por ambiente, custos do ciclo e token do workspace
guardado cifrado. Roda em Bun e Node.

- Config 100% injetada: o pacote não lê `process.env` nem abre conexão.
- O host fornece, por porta: repositórios (`InfraScheduleRepositoryInterface`,
  `InfraOperationRepositoryInterface`, `InfraIntegrationRepositoryInterface`), cache com
  compare-and-set (`InfraCacheInterface`), contador de falhas, auditoria (`InfraAuditRecorderInterface`)
  e conferência de senha (`InfraPasswordVerifierInterface`).
- Casos de uso exportados: `ListInfraEnvironmentsUseCase`, `PowerOffEnvironmentUseCase`,
  `PowerOnEnvironmentUseCase`, `SaveEnvironmentScheduleUseCase`, `GetInfraCostsUseCase`,
  `GetInfraOperationUseCase`, `RunInfraSchedulesUseCase`, `RecoverInterruptedInfraOperationsUseCase` e os
  quatro de integração (`Save`/`Get`/`Remove`/`VerifyInfraIntegrationUseCase`).
- `@adatechnology/infra-module/testing` traz fakes e harnesses para o host testar suas rotas
  (importa `bun:test`: usar só em teste).

```bash
bun add @adatechnology/infra-module @adatechnology/infra-contracts
```

## Uso mínimo

```ts
import { createInfraModule, runInfraMigrations } from '@adatechnology/infra-module'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

await runInfraMigrations({ db, migrate }) // schema `infra`, journal `infra_migrations`

const infra = createInfraModule({
  db, // conexão do host; o módulo não abre nenhuma
  config: { env, environmentToken, workspaceId, environmentId, encryptionKeyBase64, managedPattern, databaseWaitSeconds },
  providers: { cache, audit, passwordVerifier, logger, findAgentName, rateLimiter },
})
```

- **Banco:** tabelas em `pgSchema('infra')` com migrations embarcadas. Quem já tinha as tabelas no `public`
  copia os dados na própria migration do host (exemplo: `apps/api-ada/drizzle/0006_*.sql` do `ada-technology`).
- **Rotas:** `infra.routes` é uma tabela declarativa (`@adatechnology/module-http`), montável pelo adaptador
  `/fetch` ou `/uws`, ou traduzida para o router do host. A identidade chega pronta em `context.auth`
  (`userId` = administrador, escopo `INFRA_ADMIN_SCOPE`). Cada rota declara `rateLimitProfile` (o host mapeia
  para a regra de limite por IP) e `isNoStore`.
- **Tarefa agendada:** `infra.useCases.runInfraSchedules.execute()` a cada minuto e
  `recoverInterruptedOperations.execute()` no boot.
- Exemplo completo de host: `apps/api-ada/src/infra/container.ts` e `modules/infra/adaptInfraRoutes.ts` no `ada-technology`.

## Provedores (drivers)

O módulo só conhece `InfraGatewayInterface` (inventário, ligar/desligar, uso, custo e preço). O provedor
é escolhido por `config.driver` ou direto em `createInfraGateway({ driver, token, workspaceId })`.

| Driver | Estado |
|---|---|
| `railway` | implementado (`src/drivers/railway`) |
| `aws` | previsto: implementar `InfraGatewayInterface` e registrar em `createInfraGateway` |

O preço vem do gateway (`gateway.pricing`), então cada provedor traz a própria tabela. Os códigos de erro
do provedor são genéricos: `INFRA_PROVIDER_REQUEST_FAILED` e `INFRA_PROVIDER_RATE_LIMITED`.
