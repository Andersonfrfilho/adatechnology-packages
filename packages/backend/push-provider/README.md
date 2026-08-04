# @adatechnology/push-provider

Push por **Expo** e **FCM** atrás de uma porta só. Stateless: recebe token e mensagem, devolve
resultado classificado. Não guarda estado, não conhece banco, não sabe o que é uma notificação —
isso é o `notification-module`.

## Instalação

```bash
bun add @adatechnology/push-provider
```

O `firebase-admin` é peer **opcional**, carregado por `import()` dinâmico só quando o driver FCM é
usado de fato. Quem manda push só por Expo não instala os ~50 MB do SDK do Firebase.

## Uso

```ts
import { createPushProvider } from '@adatechnology/push-provider'

const push = createPushProvider({ driver: 'expo' })
// ou: createPushProvider({ driver: 'fcm', serviceAccount })
```

Também dá para instanciar direto: `createExpoPushProvider`, `createFcmPushProvider`.

## O resultado é classificado, e é o ponto do pacote

```ts
const result = await push.send({ token, title, body, data })
```

| `outcome` | Quando | O que o módulo faz |
|---|---|---|
| `sent` | aceito pelo provedor | grava `providerMessageId` |
| `retriable` | 429, 5xx, rede | reenfileira com backoff |
| `permanent` | payload inválido, credencial errada | marca falha, **sem retry** |
| `invalid-target` | `DeviceNotRegistered`, `UNREGISTERED` | **desativa o device** |

`invalid-target` é separado de `permanent` de propósito. Token de push morre o tempo todo — app
desinstalado, reinstalado, cache limpo. Sem essa distinção, cada usuário que troca de celular
deixa para trás um token que a fila tenta para sempre.

Traduzir o vocabulário de erro do provedor é responsabilidade **daqui**: só este pacote sabe que
`DeviceNotRegistered` do Expo e `UNREGISTERED` do FCM significam a mesma coisa.

## Envio em lote

O Expo aceita até 100 mensagens por chamada, e o driver fatia sozinho. Cada item volta com o
próprio `outcome` — um token morto no lote não invalida os outros 99.

## Licença

MIT © Ada Technology
