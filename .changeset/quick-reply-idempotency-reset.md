---
"@adatechnology/conversations-ui": patch
---

Corrige reenvio da mesma mensagem pronta com anexo: a chave de idempotência agora é renovada depois de um envio completo (antes o segundo envio era descartado pelo servidor como repetição).
