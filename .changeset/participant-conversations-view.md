---
"@adatechnology/conversations-ui": minor
---

Visão do participante em `@adatechnology/conversations-ui/participant`: lista de conversas agrupada por assunto e conversa em tela cheia, mobile-first, para quem **responde** (sem takeover, templates ou envio em massa). `ParticipantConversations` recebe só um `ParticipantConversationsApi`, `subjectGroups`, `labels` e o tema; capacidade opcional por ausência de prop. Fila offline pelo `clientMessageId` (o pacote não conhece IndexedDB), rascunho por assunto e respostas rápidas que preenchem sem enviar. Estilo em `.cv-p-*`/`--cv-p-*`, sem Tailwind.

Também: `ConversationChannel` da UI passa a derivar do contracts e ganha `app` e `portal` (**quem tem `switch`/`Record` exaustivo sobre `ConversationChannel` precisa tratar os dois novos**); `MessagePayload.status` passa a ser `MessageDeliveryStatus` (ganha `queued` e `bounced`); `StatusTicks` ganha `queued` e `MessageText` saem do Tailwind para `.cv-*`.

**Requisito:** importe `@adatechnology/conversations-ui/styles.css`. A formatação do `MessageText` e as cores do `StatusTicks` agora vivem em `.cv-*` nesse arquivo; quem consumia o pacote sem ele (Sakura, quickcart) perde negrito, itálico, tachado e os tiques. `MessageText` ganha `copyOnClick` (padrão `true`, comportamento anterior preservado) e `copiedLabel` (padrão 'Copied'; antes era 'Copiado!' fixo — passe `copiedLabel` para manter o português).

**Acessibilidade do `MessageText`:** por padrão ele agora ganha `role="button"` e `tabIndex={0}` (a cópia ao toque passa a ser acionável por teclado), o que muda a ordem de Tab de quem o usa; `copyOnClick={false}` desliga os dois.
