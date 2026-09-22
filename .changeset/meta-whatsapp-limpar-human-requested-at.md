---
'@adatechnology/meta-whatsapp-module': patch
---

`takeover` e `release` agora limpam `humanRequestedAt`. Antes, só `requestHuman` mexia nesse campo, e o filtro `waitingHuman` da listagem de conversas é `humanRequestedAt is not null` — como nada zerava esse timestamp, toda conversa que já pediu atendente ficava presa para sempre na fila "aguardando atendimento" da inbox, mesmo depois de um atendente assumir e devolver a conversa ao bot. Quem chama `setMode` diretamente para outros fins continua sem afetar o campo.
