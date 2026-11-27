# @adatechnology/email-provider

E-mail por **SMTP**, **Resend** ou **SES** atrás de uma porta só, mais os parsers de recibo
(bounce e complaint) de cada um. Stateless.

## Instalação

```bash
bun add @adatechnology/email-provider
```

`nodemailer`, `resend` e `@aws-sdk/client-sesv2` são peers **opcionais** — instala-se só o do
provedor em uso.

## Uso

```ts
import { createEmailProvider } from '@adatechnology/email-provider'

const email = createEmailProvider({ driver: 'smtp', host, port, auth })
// ou 'resend' / 'ses'
```

Diretos: `createSmtpEmailProvider`, `createResendEmailProvider`, `createSesEmailProvider`.

## Etiquetas e cabeçalhos

`send({ ..., tags: { env: 'staging', template: 'reserva' }, headers: { 'X-Environment': 'staging' } })`.
Resend: `tags` viram tags do provedor (valor saneado para letras, números, `_` e `-`) e `headers` vão como estão.
SMTP: `tags` viram `X-Tag-<nome>` e `headers` vão como estão. SES ainda ignora ambos. O `notification-module` já manda
`tags.template` com a chave do modelo.

## Recibos são metade do pacote

Enviar é a parte fácil. O que faz e-mail funcionar a longo prazo é **processar o retorno**: cada
provedor avisa bounce e complaint num formato próprio, e ignorar isso queima a reputação do
domínio até a entrega cair para todo mundo.

```ts
const receipt = email.parseReceipt(webhookPayload)
// { type: 'bounce' | 'complaint' | 'delivered', target, isPermanent, reason }
```

O módulo transforma bounce permanente e complaint em **supressão**, e para de tentar. Bounce
temporário (caixa cheia) não suprime — reenfileira.

A chave de supressão é o **hash HMAC** do endereço, nunca o endereço em claro: a lista existe para
não enviar, não para virar um cadastro de e-mails (`security.md` §1).

## Licença

MIT © Ada Technology
