---
"@adatechnology/whatsapp-provider": patch
---

`baseUrl` agora também pode vir da variável de ambiente `WHATSAPP_GRAPH_BASE_URL`, sem precisar que a app consumidora leia `process.env` e repasse via config manualmente. Prioridade: `config.baseUrl` explícito > `WHATSAPP_GRAPH_BASE_URL` > Graph API real.
