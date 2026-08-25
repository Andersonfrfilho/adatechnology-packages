---
'@adatechnology/user-module': patch
---

Migração do schema `user` regenerada no formato novo do drizzle-kit.

O pacote foi construído com `drizzle-kit@0.31.10`, que gera `meta/_journal.json` + `NNNN_nome.sql`
— formato que `drizzle-orm@1.0.0-rc.4` (usado pelos consumidores, incluindo `notification-module`)
recusa ao migrar: `"We detected that you have old drizzle-kit migration folders. You must upgrade
drizzle-kit and run \"drizzle-kit up\""`. Todo consumidor com `drizzle-orm` 1.x nessa faixa não
conseguia rodar `runUserMigrations` nenhuma vez.

`drizzle-kit`/`drizzle-orm` sobem para `1.0.0-rc.4` (mesmo par que `notification-module` já usa) e a
migração foi regenerada — schema idêntico, só o layout do arquivo muda (uma pasta por migração, como
`notification-module` já produz). `UserDatabase` trocou de `PgDatabase` para `PgAsyncDatabase`
(renomeado no `pg-core` do drizzle-orm 1.x); `peerDependencies.drizzle-orm` alarga para `<2`,
igualando o teto que `notification-module` já declara.

Achado rodando a migração de verdade contra Postgres ao integrar o módulo em `transportada`
(064/T1) — nenhum teste de contrato do próprio pacote pega isso, porque nenhum roda `drizzle-kit`
com uma versão de `drizzle-orm` diferente da que o `bun test` local usa.
