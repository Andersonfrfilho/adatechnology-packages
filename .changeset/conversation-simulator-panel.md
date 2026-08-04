---
'@adatechnology/conversations-ui': minor
---

`ConversationSimulatorPanel` em `@adatechnology/conversations-ui/preview`: a moldura do simulador
de cliente — `<aside>`, cabeçalho com título e telefone, botão de fechar — em volta do
`ConversationPreview` que já existia.

Cada produto tinha reescrito essa moldura, e as cópias divergiram no que importa: uma migrou para
`createPreviewBridgeClient`, que assina no servidor, e a outra ficou em
`createPreviewWebhookClient`, que exige publicar o app secret no bundle. Correção de segurança que
chegou a um produto e não aos outros — exatamente o que um componente compartilhado evita.

O host continua dono do que é dele: `displayNumber` já formatado (máscara de telefone é convenção
regional), `labels` parciais, e `headerActions` para ações extras no cabeçalho. O ícone de fechar é
SVG inline, para o pacote não impor biblioteca de ícone a quem consome.

Abaixo de 1024px o painel vira sobreposição de tela cheia: `24rem` fixos ao lado da thread não
cabem em tela estreita, e o que encolhia era justamente a conversa que se quer observar.
