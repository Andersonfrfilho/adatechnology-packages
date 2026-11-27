---
'@adatechnology/conversations-ui': minor
---

`ConversationsWorkspace` ganha `quickRepliesBar`: faixa de botões com as mensagens prontas do host (`api.listQuickReplies`) no topo da conversa. Clicar insere o texto no campo, sem enviar; o que passa de `maxVisible` (padrão 4) vai para o menu "Mais", acessível por teclado (Esc fecha, setas navegam). Também exporta `QuickRepliesBar`, `ConversationQuickRepliesBar` e `splitQuickReplies`.
