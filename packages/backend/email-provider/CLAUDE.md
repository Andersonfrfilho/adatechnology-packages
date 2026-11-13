# CLAUDE.md — @adatechnology/email-provider

## Propósito

SDK stateless de e-mail — SMTP, Resend e SES atrás de uma única porta (`EmailDriverPort` do
`@adatechnology/notification-contracts`). Não abre banco, não conhece o `notification-module`.

Spec: `.specs/features/notification-trio/spec.md` (Fase 2).

## Uso

```ts
import { createEmailProvider } from '@adatechnology/email-provider'

// dev — SMTP_URL aponta para o Mailpit do docker-compose.yml da raiz
const email = createEmailProvider({ driver: 'smtp', from: environment.MAIL_FROM, smtpUrl: environment.SMTP_URL })

// produção
const email = createEmailProvider({ driver: 'resend', from: environment.MAIL_FROM, apiKey: environment.RESEND_API_KEY })
const email = createEmailProvider({ driver: 'ses', from: environment.MAIL_FROM, region: 'us-east-1' })

await email.send({ to, subject: 'Pedido a caminho', html, text })
```

## `nodemailer` / `resend` / `@aws-sdk/client-sesv2` são peer opcionais

Nenhum é importado estaticamente. Cada `create*EmailProvider` só faz `import()` dinâmico quando
chamado **sem** um cliente injetado — quem usa só um driver não carrega os outros dois SDKs.
Todo teste do pacote injeta o cliente (`transportClient`/`client`) e nunca toca rede ou SDK real.

## Classificação de erro

| Driver | Sinal | Resultado |
|---|---|---|
| SMTP | resposta aceita vazia + rejeitada não vazia, ou código 550/551/553 | `invalid_target` |
| SMTP | código 5xx (exceto os acima) | `permanent` |
| SMTP | código 4xx, ou sem código (rede) | `retriable` |
| Resend | `error.name` = `rate_limit_exceeded`, `*_quota_exceeded`, `internal_server_error`, `application_error`, ou `statusCode` 429/5xx | `retriable` |
| Resend | qualquer outro `error.name` (validação, credencial, etc.) | `permanent` |
| SES | `TooManyRequestsException`, `LimitExceededException`, `InternalServiceErrorException`, `ConcurrentModificationException` | `retriable` |
| SES | `MessageRejected`, `MailFromDomainNotVerifiedException`, `AccountSuspendedException`, `SendingPausedException`, outro | `permanent` |

**Nenhum driver devolve `invalid_target` para "endereço não existe"** fora do SMTP síncrono —
bounce de e-mail é, por natureza do protocolo, assíncrono. É por isso que existem os parsers de
recibo abaixo, e a spec documenta essa assimetria em vez de fingir paridade com push (§11).

## Parsers de recibo (`receipts/`)

Traduzem o webhook assinado do provedor para `DeliveryReceipt` do contracts. A verificação HMAC
acontece **antes**, sobre o `rawBody`, na rota do módulo — os parsers só recebem JSON confiável.

- `parseResendWebhook(payload)` — `email.delivered` → `delivered`; `email.bounced` → `bounced` +
  supressão `bounce`; `email.complained` → `failed` + supressão `complaint`; qualquer outro tipo
  (`email.sent`, `email.opened`, ...) → `undefined`.
- `parseSesNotification(rawBody)` — dois `JSON.parse` em sequência: o envelope da SNS
  (`Type`, `Message`) e, dentro de `Message`, o evento da SES (`Bounce`/`Complaint`/`Delivery`).
  Confirmação de assinatura da SNS (`Type !== 'Notification'`) e payload malformado devolvem
  `undefined` sem lançar.

## Comandos

```bash
pnpm --filter @adatechnology/email-provider run check   # tsc --noEmit
pnpm --filter @adatechnology/email-provider run test    # bun test
pnpm --filter @adatechnology/email-provider run build   # tsup (esm + cjs + dts)
```
