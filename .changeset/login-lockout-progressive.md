---
'@adatechnology/login-lockout': minor
'@adatechnology/user-module': minor
'@adatechnology/user-contracts': minor
'@adatechnology/module-http': minor
---

Bloqueio progressivo de login. Pacote novo `@adatechnology/login-lockout`: cada bloqueio dura o dobro do anterior até um teto (15, 30, 60 min... 24 h), um dia sem falhas perdoa, identificador que não existe também trava (só o HMAC é gravado), atualização atômica no Postgres e pré-verificação por chave composta (`[ip, telefone]`). `user-module` ganha `lockout.lockMultiplier`, `maxLockMinutes`, `forgiveAfterMinutes` e `identifierSecret` (migration `0004`: `lock_level`, `last_failed_login_at` e `user.login_lockouts`); sem `lockMultiplier` a duração continua fixa. `module-http` exporta `resolveClientIp` (IP atrás de proxy confiável).
