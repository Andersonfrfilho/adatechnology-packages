---
'@adatechnology/conversations-ui': minor
---

`createPreviewBridgeClient`: simulador de cliente sem app secret no navegador.

O único caminho existente para o preview entregar mensagem era `createPreviewWebhookClient`, que
monta o payload da Meta e o assina com HMAC no navegador. Isso exige o app secret dentro do bundle,
e bundle é público onde quer que seja servido: em qualquer ambiente com URL acessível — homologação
inclusive — usar essa fábrica equivale a publicar o segredo. Quem o tiver forja webhooks válidos
daquele app da Meta, injetando mensagem de qualquer número e disparando os fluxos, e o segredo não
dá para revogar sem derrubar os webhooks reais junto.

A ponte inverte quem assina: o navegador manda a INTENÇÃO (`{ kind: 'text', from, text }`) para uma
rota do próprio host, autenticada pela sessão que o painel já tem, e o servidor monta o payload e
assina com o segredo que nunca sai de lá. Mandar a intenção, e não o payload pronto, também impede
que a rota vire um injetor de webhook arbitrário para quem tiver sessão.

O pacote não decide autenticação: o host injeta `sendCommand` (reaproveitando o cliente HTTP que já
tem sessão e refresh de token) ou `endpointUrl` + `headers`. `ConversationPreview` não muda — ele já
recebia o cliente por prop, e as duas fábricas satisfazem a mesma interface.

`createPreviewWebhookClient` continua exportada para execução puramente local, onde o bundle não é
servido para ninguém, agora documentada como tal.
