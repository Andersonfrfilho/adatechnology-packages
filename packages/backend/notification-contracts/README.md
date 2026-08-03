# @adatechnology/notification-contracts

Tipos, schemas zod e portas do trio de notificações. **Sem comportamento de runtime** — o módulo
valida com ele, os drivers implementam as portas dele, o frontend tipa as chamadas com ele, e
mudança de contrato quebra todos em compile-time em vez de em produção.

Única dependência: `zod`.

## Instalação

```bash
bun add @adatechnology/notification-contracts
```

## O que traz

| Área | Conteúdo |
|---|---|
| Entidades | `Notification`, `Delivery`, `Device`, `Preference`, `Template`, `Suppression` |
| Canais | `NOTIFICATION_CHANNEL` — `inbox`, `push`, `email`, `whatsapp` |
| Portas de driver | `PushDriverPort`, `EmailDriverPort`, `WhatsAppDriverPort`, `InboxDriverPort` |
| Portas do host | `RecipientResolverPort`, `QueuePort`, `RealtimeNotifierPort`, `LoggerPort` |
| Entrada | `sendNotificationSchema`, `registerDeviceSchema`, `updatePreferencesSchema`, … |
| Eventos | hooks de ciclo de vida da entrega |
| Erros | `NotificationError` e subclasses, com `statusCode` e `code` estáveis |

## `DeliveryAttemptResult` é união discriminada

```ts
type DeliveryAttemptResult =
  | { outcome: 'sent'; providerMessageId?: string }
  | { outcome: 'retriable'; errorCode: string; message: string }
  | { outcome: 'permanent'; errorCode: string; message: string }
  | { outcome: 'invalid-target'; errorCode: string; message: string }
```

Quem classifica é o **driver**, nunca o módulo: só ele conhece o vocabulário de erro do provedor.
`invalid-target` é separado de `permanent` porque tem consequência própria — o device é desativado
ou o e-mail entra na lista de supressão, em vez de a fila insistir para sempre num token morto.

## Invariantes

- **`companyId` nunca entra em schema de corpo.** Vem do contexto autenticado do host.
- **Nenhum tipo de HTTP aqui.** Rota é assunto do `@adatechnology/module-http`; este pacote é
  domínio. Um contracts que conhece a palavra "rota" acaba amarrado ao transporte.
- **Nenhuma porta valida token.** O host resolve identidade e entrega pronta (`security.md` §2).
- Alvo de entrega (telefone, e-mail) nunca aparece cru em log — ver `maskTarget`/`hashTarget` no
  módulo.

## Licença

MIT © Ada Technology
