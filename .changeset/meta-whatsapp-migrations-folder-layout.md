---
'@adatechnology/meta-whatsapp-module': minor
---

Migrations no layout do `drizzle-kit` 1.x (`<timestamp>_<nome>/migration.sql`), que é o único que o
migrator do `drizzle-orm` 1.x do consumidor lê. Da 0.2.x em diante o pacote publicou
`0000_nome.sql` + `meta/_journal.json`, e o migrator 1.x recusa esse layout ("run drizzle-kit up").

As quatro migrations da 0.1.0 mantêm EXATAMENTE os nomes (`20260725195853_freezing_switch`,
`20260725210958_military_leper_queen`, `20260725214800_illegal_black_tarantula`,
`20260725234507_normal_viper`) e o SQL idêntico byte a byte: bancos que já as registraram em
`drizzle.meta_whatsapp_migrations` não as reaplicam. As antigas 0004–0010 entram como pastas novas,
com timestamps posteriores e SQL aditivo idêntico ao dos arquivos anteriores (tipo de
`messages.type`, moderação, documentos, `flow_media`, transcrição, política de transcrição em
`settings` e `flow_media.meta_media_ids`). Nenhum DROP nem renomeação.

`drizzle-kit`/`drizzle-orm` sobem para `1.0.0-rc.4` (dev), o peer passa a `>=0.36.0 <2` e
`MetaWhatsAppDatabase` passa a `PgAsyncDatabase`, como nos demais módulos.
