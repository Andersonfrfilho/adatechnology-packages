---
'@adatechnology/user-contracts': minor
'@adatechnology/user-module': minor
---

Alinha `EmailDriverPort` ao formato de `@adatechnology/notification-contracts`

`SendEmailParams` passa a exigir `html` e `text` (antes: `body` mais `html` opcional) e
`DeliveryAttemptResult` vira união discriminada por `outcome` (`sent` / `invalid_target` /
`retriable` / `permanent`) no lugar de `{ success }`. Com as duas formas idênticas, qualquer driver
de `@adatechnology/email-provider` entra em `providers.email` sem adapter — que era a promessa da
redeclaração e não se cumpria.

O texto do e-mail de redefinição sai de dentro do use-case e vira `passwordReset.buildEmail`, com
um padrão neutro no módulo: copy é vocabulário do host, e cinco produtos consomem este pacote.

Breaking para quem já implementava `EmailDriverPort` à mão.
