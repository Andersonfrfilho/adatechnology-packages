---
'@adatechnology/user-contracts': minor
'@adatechnology/user-module': minor
---

- Administrador define a senha de outra pessoa: `PUT /admin/users/:id/password` (escopo `user:admin`, `204`) e `SetUserPasswordUseCase`. Revoga as sessões da pessoa, limpa o bloqueio e dispara `onPasswordChanged` com `changedByUserId` para auditoria. Conta de provedor externo responde `409 USER_PASSWORD_NOT_LOCAL` (`PasswordNotLocalError`). Contrato: `setUserPasswordSchema`.
- `refreshToken.sameSite` aceita `strict` (`REFRESH_COOKIE_SAME_SITE.STRICT`). O padrão continua `lax`.

Aditivo: nenhuma rota ou padrão existente mudou.
