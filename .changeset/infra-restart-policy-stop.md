---
'@adatechnology/infra-contracts': minor
'@adatechnology/infra-module': minor
---

Desligar serviço que volta sozinho (o Postgres do Railway tem política de reinício "on failure") sem apagar nada: depois de parar e conferir, guarda a política original, troca por "nunca" (`setRestartPolicy`), sobe um deployment novo já com ela, espera ficar de pé e então para. O ligar devolve a política guardada e sobe por redeploy. Substitui a remoção do deployment como segunda tentativa. `InfraGatewayInterface` ganha `getRestartPolicy` e `setRestartPolicy` (drivers novos precisam implementá-los) e o contrato ganha `InfraRestartPolicyStoreInterface`.
