---
'@adatechnology/scheduling-module': patch
---

Ordena a migration 0001: os únicos compostos `(id, company_id)` passam a ser criados antes das
chaves estrangeiras que os referenciam. Na ordem anterior o Postgres recusava a FK com
`there is no unique constraint matching given keys for referenced table "resources"`, e a
migration abortava — nenhum banco novo conseguia subir o schema.
