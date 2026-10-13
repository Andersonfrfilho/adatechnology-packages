---
'@adatechnology/infra-contracts': minor
'@adatechnology/infra-module': minor
---

Desligar serviço que não obedece ao comando de parar: depois de parar e conferir, o que seguir RUNNING (o Postgres do Railway volta pela política de reinício "on failure") tem o deployment removido (`removeDeployment`, `deploymentRemove`) e é conferido de novo; se ainda assim seguir no ar, a operação falha com `INFRA_SERVICE_STILL_RUNNING`. Deployment removido conta como parado e sobe de novo por redeploy (`isRemoved`). `InfraGatewayInterface` ganha `removeDeployment`: drivers novos precisam implementá-lo.
