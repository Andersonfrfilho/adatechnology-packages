---
'@adatechnology/notification-module': patch
---

fix(notification-module): `ensureTemplate` grava explicitamente a versão 1 (`TemplateRepository.insertVersion`, sem `max+1`); a corrida entre duas chamadas colide no índice único `idx_templates_identity` (23505) e vira "já existe", em vez de gravar uma v2 duplicada.
