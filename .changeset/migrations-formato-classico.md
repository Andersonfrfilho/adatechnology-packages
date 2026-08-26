---
'@adatechnology/user-module': patch
---

Migrations voltam ao formato que o migrator do host entende, e um teste impede a regressao.

O `drizzle-kit` 1.x gera uma pasta por migration, com `snapshot.json` e sem `meta/_journal.json`.
O `migrate` do `drizzle-orm` — que e o que o host chama em `runUserMigrations` — le apenas o formato
classico e falha com "Can't find meta/_journal.json file".

O detalhe que fez isso passar batido: nada no pacote quebra. Testes passam, build passa, publicacao
passa. O que quebra e o deploy do host, no passo de migration, depois de a imagem ja ter subido — e
so no primeiro ambiente que instalar a versao nova.

O `avatar_key` entra como `0001_avatar_key`, e a `0000` mantem a tag original: o historico gravado em
`user_migrations` nos bancos que ja rodaram e por tag, e renomear faria a primeira migration rodar de
novo contra um schema que ja existe.
