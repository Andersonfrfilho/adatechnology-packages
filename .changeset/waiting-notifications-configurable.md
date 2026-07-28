---
'@adatechnology/conversations-ui': minor
---

`useWaitingNotifications` agora é configurável e vive sobre o `ConversationsProvider`.

Antes o hook assumia o vocabulário de um produto (título fixo, corpo fixo, ícone fixo) e sua própria
chamada HTTP. Agora recebe `params` repassados crus ao `fetchConversations` — o que permite filtrar
não lidas **no servidor** em vez de baixar a lista inteira e contar no cliente —, `labels.title` e
`labels.body` como funções da conversa, `icon`, `intervalMs` e `enabled`.

O retorno passou de `number` para `{ unreadCount, conversations, refresh }`. O `refresh` existe
porque o polling é o piso, não o mecanismo: quem já recebe SSE ou acabou de marcar tudo como lido
sabe da mudança antes do próximo tick, e esperar o intervalo inteiro faz a interface parecer travada.
Uma trava de reentrância impede que um tick dispare sobre a busca anterior ainda em voo.
