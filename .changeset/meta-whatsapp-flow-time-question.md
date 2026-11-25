---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/conversations-ui': minor
---

Pergunta de horário no fluxo: `questionType: 'time'` aceita `12:30`, `12h30`, `12h`, `9h` e guarda `HH:MM`; `validation.minTime`/`maxTime` (inclusivos) e `validation.windowsContextKey` (faixas permitidas que o host põe no contexto, inclusive passando da meia-noite), com os motivos `before-min-time`, `after-max-time` e `outside-allowed-windows`. Contracts exporta `parseFlowTime`, `readFlowTimeWindows`, `isWithinFlowTimeWindow` e `FlowTimeWindow`. O runner ganha `validateAnswer` (validador do host depois da validação do pacote; recusa vira `rejected-by-host` e segue o mecanismo de nova tentativa). O editor de fluxos oferece o tipo "Horário" com os campos de mínimo, máximo e faixas.
