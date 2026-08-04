---
'@adatechnology/keycloak-admin': major
---

`@adatechnology/keycloak-admin` passa a ser o cliente agnóstico da Admin API do Keycloak.

**Movimentação de nome.** Até a linha `0.1.x`, este nome carregava a implementação NestJS, que
já foi republicada como `@adatechnology/nestjs-keycloak-admin`. Quem depende do comportamento
antigo troca o nome da dependência e não muda mais nada:

```diff
-"@adatechnology/keycloak-admin": "^0.1.16"
+"@adatechnology/nestjs-keycloak-admin": "^0.1.22"
```

O nome limpo agora entrega um pacote sem framework: nenhum `@nestjs/*` nos peers, nenhum
decorator, nenhum container. Só `zod` como peer (`^3.24.1 || ^4.0.0`) e `fetch` injetável.

**Autenticação é service account, não usuário administrador.** O pacote fala
`grant_type=client_credentials` com um client confidencial do próprio realm. Não existe caminho
de código que envie `username` ou `password` para o endpoint de token — o pacote antigo usava
`grant_type=password` com o admin do realm master, e essa credencial deixa de ser necessária.
Um teste de contrato varre todas as requisições emitidas e falha se `username`, `password` ou
`grant_type=password` aparecerem em qualquer corpo.

**Token com cache e renovação antecipada.** O token é reaproveitado enquanto vivo e renovado
30s antes de expirar; chamadas concorrentes compartilham a mesma requisição em voo, em vez de
disparar uma por chamador.

**Redação de segredo em duas camadas.** O `context` do erro é montado por allowlist e depois
passa por um redator que substitui `clientSecret`, o access token da chamada e a senha enviada
por `[REDACTED]`, em profundidade. Configuração inválida reporta só o caminho do campo
(`{ fields: ['baseUrl', 'realm'] }`), nunca o valor. Coberto por um teste que encara um Keycloak
hostil, devolvendo cabeçalho e corpo recebidos dentro da mensagem de erro.

Operações: `createUser`, `deleteUser`, `findUserByEmail`, `setEnabled`, `setPassword`,
`setTemporaryPassword`, `updateAttributes`, `updateUser`.
