---
'@adatechnology/notification-module': patch
---

Compatibilidade com drizzle 1.x. O migrator do 1.x recusa o layout antigo de
`meta/_journal.json` e quebrava o consumidor no boot; a pasta de migrations foi convertida
para o layout com diretórios datados. `PgDatabase` deixou de ser exportado pelo pg-core —
`PgAsyncDatabase` é o substituto — e o tipo de transação passa a ser derivado do próprio
`db`, para não depender de um nome de classe que a próxima major pode trocar. O peer de
`drizzle-orm` agora aceita a faixa `>=0.36.0 <2`.
