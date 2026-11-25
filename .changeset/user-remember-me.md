---
'@adatechnology/user-contracts': minor
'@adatechnology/user-module': minor
'@adatechnology/user-ui': minor
---

"Lembrar de mim" opt-in no login. `SignInParams.rememberMe?` / `localCredentialsSchema.rememberMe?`; `SignInForm` e `SignInScreen` ganham `showRememberMe` (rótulo `signInRememberMe`, padrão "Lembrar de mim"). No servidor, `rememberMe: true` emite refresh persistente com `refreshToken.rememberExpiresInSeconds` (padrão = `expiresInSeconds`, 30 dias) e `false` emite cookie de sessão com validade de servidor `refreshToken.sessionExpiresInSeconds` (padrão 24 h); a escolha viaja no valor do cookie e o refresh a repete na rotação. Sem o campo nada muda: mesmo cookie, mesma validade.
