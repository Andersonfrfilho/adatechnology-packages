---
'@adatechnology/conversation-module': patch
---

Migrations no layout do `drizzle-kit` 1.x (`<timestamp>_<nome>/migration.sql`), porque o migrator
do `drizzle-orm` 1.x do consumidor não lê o layout antigo.

O pacote nasceu com `drizzle-kit@0.31.10`, que gera `src/migrations/0000_nome.sql` mais
`src/migrations/meta/_journal.json`. O primeiro consumidor roda `drizzle-orm@1.0.0-rc.4`, cujo
migrator espera uma pasta por migration — sem isso, ligar as migrations do pacote no consumidor
quebrava o `pre-deploy`. `drizzle-kit` e `drizzle-orm` sobem para `1.0.0-rc.4` nas devDependencies,
as migrations foram regeneradas nesse layout (preservando o `CREATE SCHEMA IF NOT EXISTS` da
primeira migration) e a suíte de integração foi adaptada à API 1.x do driver `bun-sql`
(`drizzle({ client })` no lugar de `drizzle(client)`, e o retorno do `migrate` agora inclui
`MigratorInitFailResponse`).
