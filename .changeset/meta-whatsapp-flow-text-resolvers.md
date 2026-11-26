---
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/meta-whatsapp-contracts': minor
---

Textos do runner por empresa/conversa: `defaultFallbackMessage`, `rejectionMessages[motivo]`, `nonTextAnswerMessage`, `handoff.message` e `handoff.outOfHoursMessage` aceitam string ou resolvedor `(ctx: FlowTextContext) => string | undefined` (síncrono ou assíncrono); `undefined` segue a cadeia de sempre e erro vai para `onFlowRunnerError` com `stage: 'text'`, valendo o texto padrão. Strings continuam funcionando igual. Exporta `FlowConfigText`, `FlowTextResolver`, `FlowTextContext`, `FlowTextKind` e `resolveFlowConfigText`. `FlowRunnerErrorDetails.stage` ganha `'text'` e `'validate-answer'`.
