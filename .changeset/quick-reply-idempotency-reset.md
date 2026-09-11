---
"@adatechnology/conversations-ui": patch
---

Corrige reenvio da mesma mensagem pronta com anexo: a chave de idempotência agora é renovada depois de um envio completo e depois do "Tentar de novo" avulso de um anexo (antes o reenvio era descartado pelo servidor como repetição).
