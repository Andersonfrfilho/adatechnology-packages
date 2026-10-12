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

Rotas HTTP e tabelas Drizzle ficam no host: o formato de rota, a autorização e o limite de taxa são
do produto. O app `ada-technology` é o exemplo de host (`apps/api-ada/src/infra/container.ts`).

## Provedores (drivers)

O módulo só conhece `InfraGatewayInterface` (inventário, ligar/desligar, uso, custo e preço). O provedor
é escolhido por `config.driver` ou direto em `createInfraGateway({ driver, token, workspaceId })`.

| Driver | Estado |
|---|---|
| `railway` | implementado (`src/drivers/railway`) |
| `aws` | previsto: implementar `InfraGatewayInterface` e registrar em `createInfraGateway` |

O preço vem do gateway (`gateway.pricing`), então cada provedor traz a própria tabela. Os códigos de erro
do provedor são genéricos: `INFRA_PROVIDER_REQUEST_FAILED` e `INFRA_PROVIDER_RATE_LIMITED`.
