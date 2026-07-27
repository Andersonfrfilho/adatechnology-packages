---
'@adatechnology/conversations-ui': minor
---

Componentes de inbox que faltavam para montar a tela inteira pelo pacote.

Novos: `ConversationHeader`, `ConversationRow`, `ConversationContextPanel`,
`ConversationDocumentsPanel`, `ChannelIcon`, `WindowExpiredNotice`.

Novos utilitários: `conversationWindow` (janela de 24 h e filtros),
`conversationChannel` (canal do contato e filtro por canal), `conversationTranscript`,
`lib/phone`, `useDarkMode`, `useIsNarrow`.

`ConversationSummary` ganha `contactId` e `channel`, ambos opcionais — ausentes, o
comportamento é o de antes (`whatsappNumber` e canal `whatsapp`). `whatsappNumber` fica
marcado como deprecado, mas segue obrigatório para não quebrar quem já consome.

`SSEProvider` passa a devolver `ConversationEventSource`, uma superfície estrutural
mínima em vez de `EventSource` nativo: sem isso não há como alimentar a inbox com dados
mockados fora de um servidor HTTP. Um `EventSource` real satisfaz o tipo, então quem já
implementa o contrato continua válido.
