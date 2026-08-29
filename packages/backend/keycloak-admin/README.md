# @adatechnology/keycloak-admin

Cliente do Keycloak Admin API autenticado como **service account** (`client_credentials`).
Agnóstico de framework e de runtime: só depende de `fetch` e de `zod`.

Diferença deliberada para o `@adatechnology/nestjs-keycloak-admin`: aquele obtém token com
`grant_type=password` usando o usuário administrador do realm `master`. Este **nunca** envia senha
nem usuário — a identidade é do client confidencial, com `manage-users` do `realm-management`.

## Uso

```ts
import { createKeycloakAdminClient } from '@adatechnology/keycloak-admin'

const keycloak = createKeycloakAdminClient({
  config: {
    baseUrl: process.env.KEYCLOAK_URL,
    clientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET,
    realm: process.env.KEYCLOAK_REALM,
  },
})

const { id } = await keycloak.createUser({
  attributes: { company_id: companyId },
  email: 'admin@transportadora.example',
  enabled: true,
  firstName: 'Ada',
  lastName: 'Lovelace',
  password: { temporary: false, value: chosenPassword },
  username: 'admin@transportadora.example',
})
```

Operações: `createUser`, `findUserByEmail`, `listUsers`, `updateUser`, `setEnabled`,
`updateAttributes`, `deleteUser`, `setPassword`, `setTemporaryPassword`.

`listUsers({ first, limit, search })` devolve `{ users, hasMore }`. O realm não informa total, então
a página pede um registro a mais que o limite e descarta-o: é assim que `hasMore` sai sem uma
segunda chamada.

## Token

Obtido sob demanda, guardado em memória e renovado 30s antes de expirar
(`KEYCLOAK_ADMIN_TOKEN_RENEWAL_SKEW_MS`). Chamadas concorrentes compartilham a mesma requisição em
voo — o Keycloak recebe uma, não N.

## Injeção

`fetch` e `now` são injetáveis, o que torna rede e relógio observáveis em teste:

```ts
createKeycloakAdminClient({ config, fetch: stubFetch, now: clock.now })
```

## Erros

Toda falha vira `KeycloakAdminError` com `code` estável (`KEYCLOAK_ADMIN_ERROR_CODE`), `status` e
`context`. O contexto é montado por allowlist e passa por um redator que substitui `clientSecret`,
access token e senha por `[REDACTED]` — nem a mensagem nem o erro serializado carregam segredo.

Configuração inválida falha na construção do cliente, com o **caminho** do campo no contexto e nunca
o valor.
