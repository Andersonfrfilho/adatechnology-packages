---
'@adatechnology/infra-contracts': minor
'@adatechnology/infra-module': minor
'@adatechnology/infra-ui': minor
---

Ligar e desligar serviços individuais de um ambiente: `serviceIds` opcional em `power-on` e `power-off` (casos de uso, rotas e `InfraApi`), `serviceId` na listagem de ambientes e botão Iniciar/Parar por serviço no `infra-ui`. Seleção parcial não mexe no `keepOnUntil` da agenda e recusa (404 `INFRA_SERVICE_NOT_FOUND`) id que não é do ambiente. Subir aplicação é pulado enquanto um banco do ambiente fora da seleção estiver parado.
