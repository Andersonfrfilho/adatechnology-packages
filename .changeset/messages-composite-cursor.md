---
'@adatechnology/conversations-ui': minor
'@adatechnology/meta-whatsapp-module': minor
---

Paginação de mensagens com cursor composto `(createdAt, id)`. conversations-ui: `ConversationsApi.fetchMessages` aceita `beforeId` e `loadOlderMessages` o envia junto de `before` (id da mensagem mais antiga da tela; `buildOlderMessagesRequest` exportada do hook), então mensagens no mesmo instante da fronteira não somem nem se repetem; o mock do preview segue a mesma regra. Host que só entende `before` ignora o campo novo. meta-whatsapp-module: `ListMessagesUseCase` e `MessageRepository.listByConversation` aceitam `beforeId` e comparam `(created_at, id)` com a linha do cursor lida no banco (microssegundos, e só dentro da mesma empresa e sessão); id desconhecido ou que não é UUID cai no `before`. Sem migration.
