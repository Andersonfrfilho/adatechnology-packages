---
'@adatechnology/user-module': patch
---

Corrige o refresh com `refreshToken.absoluteExpiresInSeconds`: o `rotate` interpolava um `Date` em SQL cru, que o driver postgres-js não serializa (`ERR_INVALID_ARG_TYPE`, `/auth/refresh` respondia 500). Agora vai como ISO tipado; o mesmo vale para `PasswordResetTokenRepository.deleteExpired`.
