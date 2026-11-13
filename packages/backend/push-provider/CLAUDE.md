# CLAUDE.md — @adatechnology/push-provider

## Propósito

SDK stateless de push notification — Expo e FCM (mobile + web) atrás de uma única porta
(`PushDriverPort` do `@adatechnology/notification-contracts`). Não abre banco, não conhece
o `notification-module`, e quem só instala este pacote não carrega Drizzle nem rotas.

Spec: `.specs/features/notification-trio/spec.md` (Fase 2).

## Uso

```ts
import { createPushProvider } from '@adatechnology/push-provider'

const push = createPushProvider({
  driver: 'expo',
  accessToken: environment.EXPO_ACCESS_TOKEN,   // opcional para apps sem EAS
})

// ou
const push = createPushProvider({
  driver: 'fcm',
  serviceAccountJson: environment.FIREBASE_SERVICE_ACCOUNT_JSON,   // JSON, não caminho de arquivo
})

await push.send({ token, platform: 'android', title: 'Pedido a caminho', body: 'Chega em 20 min' })
```

## `firebase-admin` é peer opcional

O pacote **não depende** de `firebase-admin` em runtime — é `import()` dinâmico, só executado
quando `createFcmPushProvider` é chamado sem `messagingClient` injetado. Quem usa só Expo nunca
carrega o SDK (~40 MB). Testes injetam `messagingClient` (forma mínima em
`FcmMessagingClient.ts`) e nunca tocam o `firebase-admin` real.

## Web push é o mesmo FCM

Token de web push (VAPID) e token de app mobile passam pelo mesmo `messaging().send()` — só o
bloco `webpush` muda em vez de `android`/`apns`. É o canal que valida push no PWA do quickcart
sem depender de app mobile.

## Classificação de erro — a decisão que importa

`DeliveryAttemptResult` é decidido aqui, nunca no `notification-module`: só o driver conhece o
vocabulário de erro do provedor.

| Expo (`details.error`) | FCM (`error.code`) | Resultado |
|---|---|---|
| `DeviceNotRegistered` | `messaging/registration-token-not-registered`, `.../invalid-registration-token` | `invalid_target` — desativa o device |
| `MessageRateExceeded` | `messaging/quota-exceeded`, `.../message-rate-exceeded`, `.../unavailable`, `.../internal-error` | `retriable` |
| `MessageTooBig`, `InvalidCredentials`, qualquer código novo | `messaging/invalid-argument`, qualquer código novo | `permanent` |
| HTTP 429/5xx (Expo) | erro sem `code` reconhecível | `retriable` — quase sempre rede, e o retry é finito |
| HTTP 4xx (Expo) | — | `permanent` |

## Chunking da Expo

`sendExpoPushBatch()` fragmenta em lotes de 100 (limite documentado da API) e despacha os lotes
em paralelo (`Promise.all`, não `await` em loop). `send()` é o wrapper de lote-de-1 que satisfaz
`PushDriverPort`; o `notification-module` pode chamar `sendExpoPushBatch` diretamente quando quiser
despachar várias entregas na mesma janela sem uma chamada HTTP por token.

## Comandos

```bash
pnpm --filter @adatechnology/push-provider run check   # tsc --noEmit
pnpm --filter @adatechnology/push-provider run test    # bun test
pnpm --filter @adatechnology/push-provider run build   # tsup (esm + cjs + dts)
```
