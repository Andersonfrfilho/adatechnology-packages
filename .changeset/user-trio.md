---
'@adatechnology/user-contracts': minor
'@adatechnology/user-module': minor
'@adatechnology/user-ui': minor
---

Trio de usuário/autenticação: `user-contracts`, `user-module` e `user-ui`.

O domínio vivia dentro de `ada-technology/apps/api-ada` (tabela `agents`, login local, JWT `jose`,
refresh em Redis). Quatro outros produtos precisam do mesmo — financiamento, transportadora,
sakura-bot e quickcart — então ele sai do host e vira pacote, na mesma forma dos trios já
publicados (`catalog-*`, `scheduling-*`).

**`user-contracts`** — tipos, erros (`USER_*`, hierarquia autocontida), eventos + `UserHooks`, zod
schemas das rotas, e as portas de extensão: `AuthProviderInterface`, `AttributeMapping`,
`RefreshTokenStorePort`, `EmailDriverPort`, `ClockPort`, `LoggerPort`, `TenancyConfig`.

- `role` é `string` livre, sem enum: papel é vocabulário do produto, não do módulo.
- `TenancyConfig` é `{mode:'single', defaultCompanyId} | {mode:'multi'}` — nenhum host é assumido
  single ou multi por padrão.
- `RefreshTokenStorePort.revokeAllForUser` é **obrigatória**, não capacidade opcional: sem ela a
  redefinição de senha não encerra a sessão que ela existe justamente para expulsar.
- `issue` devolve o token cru; `rotate`/`revoke` recebem o **sha256 hex**. O token cru nunca chega
  ao armazenamento, então um dump do Redis ou da tabela não vale sessão.

**`user-module`** — `pgSchema('user')` próprio, migrations com journal em `user_migrations`, zero
`process.env`, tudo por `createUserModule({db, config, providers, hooks})`.

- Provedores: local (`Bun.password`, comparação timing-safe) e Keycloak, este último por
  `await import('@adatechnology/auth-keycloak')` só quando `config.keycloak` existe — host sem
  Keycloak não paga o custo nem quebra o CI sem o pacote.
- `confirmPasswordReset` consome o token com `UPDATE ... WHERE consumed_at IS NULL AND expires_at >
  now() RETURNING`, atômico. Coberto por teste de concorrência: dois confirms simultâneos do mesmo
  token, exatamente um resolve.
- Capacidade por ausência: sem `config.passwordReset` as rotas de reset não são publicadas — a
  alternativa seria oferecer um 500 público.
- `keycloak.attributeMapping.role` é obrigatório quando há Keycloak. Um default embutido criaria
  usuário com papel que o host não reconhece, e a falha apareceria no primeiro login em vez de no
  boot.
- Unicidade de `(provider_id, external_id)` é **por empresa**, via índice parcial. O mesmo `sub` do
  Keycloak em duas empresas são dois usuários; unicidade global faria a segunda herdar a sessão da
  primeira. Índice parcial em vez de `NULLS NOT DISTINCT` para não exigir Postgres 15+.
- Tabelas exportadas por `@adatechnology/user-module/schema`, para o host declarar FK real contra
  `"user".users`.
- `issuer`/`audience` do access token são configuráveis: sem isso um host em migração gradual, com
  dois emissores sobre o mesmo segredo, teria os dois lados recusando o token um do outro.

**`user-ui`** — `UserProvider` + hooks headless separados por fluxo (`useSignIn`,
`usePasswordReset`, `useProfile`), `UserWorkspace` composto para a conta logada, e
`SignInScreen`/`ForgotPasswordScreen`/`ResetPasswordScreen` para as telas pré-autenticação. Não
depende de `user-contracts` — tipos mínimos redeclarados, para manter zod fora do bundle do
browser, mesma decisão de `products-ui`.
