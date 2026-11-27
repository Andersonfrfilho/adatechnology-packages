---
'@adatechnology/notification-contracts': minor
'@adatechnology/email-provider': minor
'@adatechnology/notification-module': minor
---

E-mail de ambiente de teste e etiquetas de rastreio.

- `notification-contracts`: `SendEmailParams` ganha `tags` e `headers`; novo `markEmailForEnvironment` (puro e idempotente) põe prefixo no assunto, faixa no topo do HTML e primeira linha no texto, para o host marcar tudo que sai fora de produção e a prévia mostrar exatamente o enviado.
- `email-provider`: Resend repassa `tags` (valores saneados para letras, números, `_` e `-`) e `headers`; SMTP envia `tags` como `X-Tag-<nome>` e os `headers`. SES ainda ignora ambos.
- `notification-module`: toda entrega de e-mail leva a tag `template` com a chave do modelo.
