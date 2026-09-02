---
'@adatechnology/notification-module': patch
---

As migrations embarcadas viram convergentes, e o upgrade da rc.2 deixa de derrubar o host

A `0000` atual espremeu as três migrations da `0.1.0-rc.2` num único ponto de partida, com
timestamp posterior a elas. O migrator do drizzle decide o que aplicar comparando timestamps: num
banco que já rodou a rc.2, essa baseline é "nova" e é executada — e o `CREATE SCHEMA "notification"`
cru estourava, com a api do host morrendo no boot. **O upgrade do pacote quebrava exatamente quem
já era usuário dele.**

Todo `CREATE` ganha `IF NOT EXISTS`, o `ADD COLUMN` também, e os dois `ADD CONSTRAINT` passam a
viver num bloco anônimo que engole `duplicate_object` — o Postgres não tem `IF NOT EXISTS` para
constraint. A baseline passa a descrever o ESTADO desejado em vez de uma sequência de criações, que
é o que uma baseline espremida precisa ser: ela não é "o próximo passo", é "o ponto de partida", e
pode encontrar o banco em qualquer estado anterior a ela.

Verificado contra Postgres real, nos três cenários:

| | |
|---|---|
| banco vazio → `0.1.x` | aplica igual a antes |
| banco em `rc.2` → `0.1.x` | **passa** (antes: erro no `CREATE SCHEMA`), criando só o que faltava — `category_policies` e `deliveries.attachments` |
| reaplicar sobre banco já migrado | no-op |

Nos dois primeiros o schema resultante é idêntico: colunas, índices e constraints, incluindo o
`ON DELETE CASCADE` que a rc.2 tinha introduzido na sua terceira migration.

`migrations.test.ts` cobra a forma do SQL a cada `bun test`, para que a próxima migration gerada
não reintroduza um `CREATE` incondicional sem ninguém perceber.
