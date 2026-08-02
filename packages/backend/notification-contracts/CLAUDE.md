# CLAUDE.md — @adatechnology/notification-contracts

## Propósito

Fonte única de tipos, schemas zod e portas do trio `notification-*`. **Sem comportamento de
runtime** — a única função exportada é `createWhatsAppDriverFromChannel`, um adaptador puro.
Backend valida com ele, frontend tipa as queries com ele: mudança de contrato quebra os dois
lados em compile-time, nunca em produção.

Spec: `.specs/features/notification-trio/spec.md` · ADR: `docs/adr/0001-notification-trio.md`

## Mapa dos arquivos

| Arquivo | O que define |
|---|---|
| `notification.types.ts` | canais, status, plataformas, drivers, supressão, entidades, params/result |
| `channelDrivers.ts` | `DeliveryAttemptResult` + portas de push, e-mail, WhatsApp e SMS |
| `providers.ts` | identidade (auth, destinatário) e infra (fila, cache, realtime, clock, logger, métricas) |
| `http.types.ts` | rota como dado: `NotificationRoute`, contexto, resultado (`json`/`empty`/`stream`) |
| `schemas.ts` | validação de fronteira |
| `events.ts` | 9 eventos de domínio + `NotificationHooks` |
| `errors.ts` | hierarquia autocontida com `statusCode` e `code` |
| `whatsappDriver.ts` | adaptador duck-typed sobre o canal do `meta-whatsapp-module` |

## Invariantes (quebrar = code review reprovado)

- **`companyId` nunca entra em schema de corpo de requisição.** Vem do contexto autenticado.
  Há teste garantindo isso em `strictness.test.ts`.
- **Nenhum import de `meta-whatsapp-*`.** O canal WhatsApp é descrito por estrutura
  (`WhatsAppSendingChannel`), não por importação — é o que mantém os trios independentes.
- **Nenhuma PII em tipo persistido.** `DeliverySummary.targetMasked`, nunca o endereço.
- **`DeliveryAttemptResult` é classificado pelo driver**, nunca pelo módulo. Só o driver conhece
  o vocabulário de erro do provedor.
- **Nada de framework em `http.types.ts`.** É o contrato que `fetch` e `uws` implementam.
- Única dependência de runtime: `zod`.

## Comandos

```bash
pnpm --filter @adatechnology/notification-contracts run check   # tsc --noEmit
pnpm --filter @adatechnology/notification-contracts run test    # bun test
pnpm --filter @adatechnology/notification-contracts run build   # tsup (esm + cjs + dts)
```

## Costura do canal WhatsApp no produto

```ts
import { createWhatsAppDriverFromChannel } from '@adatechnology/notification-contracts'

const whatsappDriver = createWhatsAppDriverFromChannel(whatsapp.channel)
```

Erros da Graph API viram `invalid_target` (131026, 131051), `permanent` (131047 janela de 24 h,
131031, 368) ou `retriable` (429, 5xx, 613). Erro sem código é tratado como retriável — quase
sempre é rede, e o retry é finito.
