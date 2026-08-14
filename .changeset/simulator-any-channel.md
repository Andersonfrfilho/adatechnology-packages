---
'@adatechnology/conversations-ui': minor
'@adatechnology/web-chat-widget': minor
---

O simulador de cliente deixa de ser exclusivo do WhatsApp: qualquer canal simula, na mesma moldura.

O painel do simulador já vivia dentro da página de conversa, mas o cliente que ele aceitava era o
`PreviewWebhookClient` — desenhado sobre o webhook da Meta, com `sendButtonReply`/`sendListReply` e
mídia **por referência** (`mediaId` de um upload anterior). Conversa no canal `webchat` não tem
webhook, não tem forma de fio para botão e manda **bytes**: com esse acoplamento, o único canal
simulável era o WhatsApp.

Entra `ConversationSimulatorClient`, uma porta neutra com três operações — `sendText`,
`sendReply(selection)` e `sendMedia?` — que colapsa a assimetria carregando o `File` e deixando o
upload para o adaptador do canal. `ConversationPreview` aceita a porta nova **ou** o cliente antigo
(adaptado por `toConversationSimulatorClient`), então nada que já usa o simulador precisa mudar.

`acceptedMediaKinds` resolve o caso do chat do site, que só tem rota para áudio: o clipe e o
microfone passaram a ser dois affordances independentes, cada um desenhado só quando o transporte
aceita aquele tipo. Melhor um botão que não existe do que um que falha ao ser tocado.

`ConversationsWorkspace` ganhou `simulator.transports`, um mapa de canal para fábrica de transporte:
o host declara quem sabe simular cada canal e o pacote monta o painel, deriva o rótulo do contato e
mantém o `render` antigo como válvula de escape. O texto do cabeçalho e o placeholder acompanham o
canal ("entrega na API do chat do site", "Escreva como o visitante…").

No `web-chat-widget`, `createWebChatSimulatorClient` é o transporte do canal `webchat`, exportado em
subpath próprio (`@adatechnology/web-chat-widget/simulator`) porque o entry principal registra o
custom element no load — o painel do atendente não pode definir a tag do widget. Ele satisfaz a
porta **estruturalmente**, sem importar `conversations-ui`: toque em opção sai como texto com o
rótulo, que é exatamente o que o botão do widget faz com um visitante real.

Ao ligar a simulação de `webchat` num ambiente: a origem do painel precisa estar em
`WIDGET_ALLOWED_ORIGINS`, senão a rota do chat recusa por `Origin`.
