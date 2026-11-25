---
'@adatechnology/meta-whatsapp-module': patch
---

`MetaWhatsAppDatabase` deixa de virar `any` em hosts com drizzle-orm 0.36–0.45 (onde `PgAsyncDatabase` não existe): nesse caso a conexão é checada contra `MetaWhatsAppDatabaseShape` (`select`, `insert`, `update`, `delete`, `execute`, `transaction`). Em drizzle 1.x o tipo continua o `PgAsyncDatabase` exato. Exporta `MetaWhatsAppDatabaseShape` e `MetaWhatsAppDatabaseFor`.
