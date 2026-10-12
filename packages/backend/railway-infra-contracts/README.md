# @adatechnology/railway-infra-contracts

Contratos do módulo de infraestrutura Railway: tipos, schemas zod, constantes, hierarquia de erros
(`RailwayInfraError`) e as portas que o host implementa (`InfraAuditRecorderInterface`,
`InfraPasswordVerifierInterface`, repositórios e cache). Sem I/O e sem dependência de produto.

```bash
bun add @adatechnology/railway-infra-contracts
```

Os `code` de erro (`RAILWAY_INFRA_ERROR_CODES`) e os valores de auditoria (`INFRA_AUDIT_ACTION`) são
estáveis: o host grava e filtra por eles.
