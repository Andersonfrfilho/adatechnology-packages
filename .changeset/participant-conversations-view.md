---
"@adatechnology/conversations-ui": minor
---

Visão do participante em `@adatechnology/conversations-ui/participant`: lista de conversas agrupada por assunto e conversa em tela cheia, mobile-first, para quem **responde** (sem takeover, templates ou envio em massa). `ParticipantConversations` recebe só um `ParticipantConversationsApi`, `subjectGroups`, `labels` e o tema; capacidade opcional por ausência de prop. Fila offline pelo `clientMessageId` (o pacote não conhece IndexedDB), rascunho por assunto e respostas rápidas que preenchem sem enviar. Estilo em `.cv-p-*`/`--cv-p-*`, sem Tailwind.

Também: `ConversationChannel` da UI passa a derivar do contracts e ganha `app` e `portal` (**quem tem `switch`/`Record` exaustivo sobre `ConversationChannel` precisa tratar os dois novos**); `MessagePayload.status` passa a ser `MessageDeliveryStatus` (ganha `queued` e `bounced`); `StatusTicks` ganha `queued` e `MessageText` saem do Tailwind para `.cv-*`.
