---
'@adatechnology/conversations-ui': patch
---

Carregar mensagens anteriores na conversa

A tela de conversa só mostrava as 50 mensagens mais recentes: `ConversationPane` chamava
`useConversationMessages` sem `before`/`limit`, e rolar para cima não buscava página nenhuma —
o histórico anterior simplesmente não existia para quem atendia uma conversa antiga.

`useConversationMessages` agora acumula páginas de mensagens antigas (`loadOlderMessages`,
`loadingOlderMessages`, `hasMoreOlderMessages`), deduplicadas por `id` e preservadas através de
refetches disparados por SSE/polling — a janela recente pode mudar sem apagar o que já foi
carregado. `ConversationPane` busca a página anterior ao chegar perto do topo do transcript (ou
pelo botão "Carregar mensagens anteriores") e devolve a rolagem ao mesmo ponto visual depois que o
conteúdo cresce por cima, via `useLoadOlderMessagesScroll` — sem isso, prepender mensagens jogaria
o operador para o meio do histórico.

Afeta os três produtos que consomem o workspace de conversas (financiamento-imobiliario-bot,
quickcart, sakura-bot).
