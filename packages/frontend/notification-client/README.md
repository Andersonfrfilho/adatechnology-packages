# @adatechnology/notification-client

Cliente **isomórfico** das rotas de notificação: HTTP tipado, registro de device e stream de
tempo real. Roda em React Native, web, Node e Bun com o mesmo código.

Sem dependência de framework — o `notification-ui` é construído sobre ele, mas não é obrigatório.

## Instalação

```bash
bun add @adatechnology/notification-client
```

## Uso

```ts
import { createNotificationClient } from '@adatechnology/notification-client'

const client = createNotificationClient({
  baseUrl: 'https://api.exemplo.com/v1',
  getAuthHeaders: async () => ({ authorization: `Bearer ${await session.accessToken()}` }),
})

const page = await client.listNotifications({ cursor })
const unread = await client.countUnread()
await client.markAsRead(notificationId)
```

`getAuthHeaders` é função, não valor: token de vida curta é renovado entre uma chamada e outra, e
capturar o header no boot deixaria o cliente autenticando com credencial vencida depois de 15
minutos.

## Tempo real sem `EventSource`

```ts
const { url, headers } = await client.resolveStreamRequest()

const subscription = subscribeToNotificationStream({
  url,
  headers,
  onEvent: () => queryClient.invalidateQueries(),
})
```

`resolveStreamRequest` existe para o assinante reaproveitar a base e os headers já resolvidos, em
vez de o chamador remontar a URL e o token por fora e os dois saírem de sincronia.

**A `EventSource` da plataforma não é usada, de propósito.** Ela não aceita cabeçalho — o token
teria que ir na query string, onde vaza para log de servidor, histórico e referer
(`security.md` §8). E o React Native não a tem nativamente. A implementação usa `fetch` +
`ReadableStream`, que resolve os dois problemas de uma vez e funciona igual nos quatro ambientes.

Reconexão com backoff exponencial e retomada por `Last-Event-ID` estão incluídas.

## Registro de device

```ts
import { createDeviceRegistration } from '@adatechnology/notification-client'
```

Registra o token de push e **remove no logout** — device que continua registrado depois da saída
manda notificação da conta antiga para o aparelho.

## Licença

MIT © Ada Technology
