---
'@adatechnology/meta-whatsapp-module': minor
---

A coordenada de uma mensagem de localização deixa de ser obrigatoriamente guardada no transcript:
nova opção `features.redactInboundLocation` e dois casos de uso para redigir o que já foi gravado.

A coordenada é dado pessoal (a casa do cliente) e nem todo host tem finalidade para ela na
conversa. Antes, `payload.location` e o rótulo `📍 Localização: <nome>` entravam sempre em
`meta_whatsapp.messages`.

- `features.redactInboundLocation` (padrão `false`, comportamento da 0.7.0 byte a byte). Ligada, a
  linha de entrada do tipo `location` é gravada sem `payload.location` (`payload` fica `NULL` se não
  sobrar chave), com `content = INBOUND_LOCATION_CONTENT` e `type = 'location'`. O gancho
  `onMessageReceived` continua recebendo a mensagem crua inteira. Com `inboundQueue`, o job leva a
  mensagem crua: a opção cobre o transcript, não a fila do host.
- `INBOUND_LOCATION_CONTENT` (`'📍 Localização'`), exportada do `index.ts`.
- `conversations.countInboundLocations({ companyId, receivedBefore })` devolve
  `{ counted, unreachable }` e `conversations.redactInboundLocations({ companyId, receivedBefore,
batchSize? })` devolve `{ redacted }` (uma passada de até `batchSize`, padrão 500; quem chama repete
  até zerar). Só a empresa pedida, só `direction = 'inbound'`, só antes de `receivedBefore`;
  `FOR UPDATE SKIP LOCKED`, sem `ORDER BY`. `unreachable` conta localizações com `payload` escalar
  string (gravação antiga do `bun-sql` com drizzle 0.x), que a redação não toca. Também exportados
  como `CountInboundLocationsUseCase` e `RedactInboundLocationsUseCase`.

Sem migration. A 0.8.0 depende de `@adatechnology/meta-whatsapp-provider@0.4.0` (`workspace:*`; era
0.3.x na 0.7.0): quem pina o provider no host sobe os dois juntos.
