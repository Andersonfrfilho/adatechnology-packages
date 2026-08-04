---
'@adatechnology/conversations-ui': minor
---

Exporta `ConversationsWorkspace`: a tela de atendimento inteira, não só as peças.

O pacote entregava cabeçalho, linha, transcript e composer soltos, e cada produto montava a
própria grade. Foi assim que a mesma inbox ganhou três larguras de coluna, dois comportamentos em
tela estreita, um contador que ninguém mais tinha e um lugar diferente para o botão do simulador —
divergência que nenhuma revisão pega, porque cada tela isolada parece correta.

A composição passa a ser do pacote. Entram junto `useConversationsInbox` (filtros de janela e
canal, busca, paginação de 50, seleção em massa, marcar lida ao abrir com guarda contra laço
quente, assumir/devolver/finalizar), `ConversationsInboxList` e `ConversationPane`.

O que varia por produto entra por slot, não por cópia da tela: `labels` (vocabulário e idioma
inteiros), `renderFilters`, `renderBulkActions`, `renderRow`, `renderAboveTranscript`,
`renderHeaderActions`, `contextEntriesOf`, `extraUtilitiesFor`, `quickReplies` e `simulator`. O
simulador é slot de render para manter o `preview/` fora do bundle de quem não o usa, e seu botão
mora no cabeçalho da conversa, ao lado de "Assumir atendimento" — ele age sobre aquela conversa, e
no cabeçalho da página parecia um filtro da inbox.

Ações ausentes na `ConversationsApi` do host não desenham afordância: sem `finalize` não há botão
de finalizar em lote.
