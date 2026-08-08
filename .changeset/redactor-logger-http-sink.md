---
"@adatechnology/logger": minor
---

Redação de PII em duas camadas (`redact`/`redactMeta`, denylist por nome de chave + varredura por
forma do valor) e transporte HTTP em lote (`HttpTransport`) — o `Logger.write` liga os dois antes
de qualquer destino, para stdout, arquivo e o novo sink NDJSON nunca verem CPF, CNPJ, e-mail,
telefone ou chave de acesso, mesmo quando o `meta` chega sujo. `LoggerConfig` ganha `sinkUrl?`
(vazio desliga o transporte) e `Logger` ganha `flush()`/`stop()`.
