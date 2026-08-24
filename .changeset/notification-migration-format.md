---
'@adatechnology/notification-module': patch
---

Corrige as migrations, que nenhum host conseguia aplicar.

O pacote era o unico do monorepo com `drizzle-kit`/`drizzle-orm` na `1.0.0-rc.4`; catalogo,
usuario e agendamento estao na `0.31.10`/`0.45.2`. As duas linhas geram formatos incompativeis:
a 1.x escreve uma pasta por migration com `snapshot.json`, e o migrator da 0.45 — que e o que
todo host instala, porque o `peerDependencies` pede `>=0.36 <2` — procura `meta/_journal.json` e
falha com `Can't find meta/_journal.json file`.

Isso valia desde a `rc.2`: `runNotificationMigrations` nunca funcionou em host nenhum, e o
sintoma so aparecia no primeiro `migrate` de quem tentasse adotar o modulo.

- `drizzle-kit` e `drizzle-orm` alinhados com os outros modulos, e as migrations regeradas no
  formato que o migrator da 0.45 le
- `NotificationDatabase` passa a ser `PgDatabase` e nao `PgAsyncDatabase`, que so existe na 1.x —
  o mesmo desalinhamento, na tipagem

Migracao: nenhuma base tinha as tabelas (era impossivel cria-las), entao as quatro migrations
antigas foram consolidadas em uma. Quem por acaso tiver o schema `notification` criado a mao
precisa apaga-lo ou marcar a migration como aplicada antes de subir.
