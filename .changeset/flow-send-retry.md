---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
---

Retentativa do envio de saída do robô. Módulo: `features.flowRunner.sendRetry` (`maxAttempts` padrão 3, `baseDelayMs` 500, `maxDelayMs` 5000, `shouldRetry`, `sleep`) repete cada mensagem do turno que falhou por rede antes de a Meta recebê-la (`isTransientSendError`, exportada), com backoff exponencial e sem reenviar o que já saiu; timeout, recusa da Meta e erro depois do envio não repetem por padrão. Esgotadas as tentativas o erro segue para `onFlowRunnerError` como antes, agora com `details.send` (`attempts`, `messageKind`, `isTransient`). Contracts: campo opcional `send` em `FlowRunnerErrorDetails` e tipo `FlowSendFailureDetails`. Sem migration.
