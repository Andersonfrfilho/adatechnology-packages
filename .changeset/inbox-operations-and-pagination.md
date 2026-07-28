---
'@adatechnology/conversations-ui': minor
---

Operações de atendimento, paginação com total e filtros de produto no `ConversationsApi`.

O contrato cobria ler e enviar, mas não **operar** a inbox: assumir, devolver e encerrar
conversa, marcar tudo como lido e listar templates para envio ficavam fora, então todo host que
precisasse disso montava as chamadas por fora do pacote — exatamente a implementação paralela
que o pacote existe para evitar.

As cinco entram como **opcionais por capacidade, não por descuido**: nem toda inbox tem fila
humana — um canal só-bot, ou um chat de site sem operador, não sabe o que é assumir conversa.
`useConversationActions(conversationId)` e `useInboxActions()` devolvem `undefined` para a ação
que a API não implementa, e é isso que a UI consulta para decidir se desenha a afordância. Quem
não implementa não ganha um botão que estoura no clique.

**Paginação.** `fetchConversations` e `getDocuments` passam a poder devolver `{ conversations,
total }` / `{ documents, total }` além do array de antes. A união é o que mantém implementações
existentes válidas sem tocar numa linha; sem o total, era impossível distinguir última página de
página cheia por acaso, e controle de paginação nenhum podia ser desenhado. `useConversationList`
e `useConversationDocuments` expõem `total`, caindo para o tamanho da página quando a API só
manda o array. `conversationsOf` / `documentsOf` / `totalOf` normalizam a união num lugar só —
cada consumidor inventando a própria checagem é erro que aparece como `.map is not a function`
em produção, não no compilador.

**Filtros de produto.** `ListConversationsParams.filters` (`Record<string, string | undefined>`)
transporta recortes que só o produto conhece — tipo de financiamento, carteira, campanha — sem
que o vocabulário de uma vertical vire campo fixo no contrato. O hook serializa o objeto na chave
de dependência, senão um `filters` recriado a cada render do host viraria refetch em laço.

`getDocuments` também ganha `source` e `sortDirection`, que o painel já precisava para filtrar
por origem e inverter a ordem.

O mock do `/preview` implementa tudo e passou a devolver a **forma paginada**, com o total contado
antes do corte — contado depois, seria sempre o tamanho da página e a paginação nunca sairia da
primeira.

**Vocabulário do produto na leitura.** `ConversationSummary.attributes` é a contraparte de
`filters`: o backend do host devolve os atributos que só ele conhece (tipo de financiamento,
carteira, campanha) e o pacote transporta sem interpretar. Sem isso, desenhar um selo próprio na
linha obrigaria o host a manter uma segunda consulta paralela à mesma listagem.

**`templateName` virou opcional** em `sendTemplate`. Reabrir a janela é a operação; escolher
*qual* template a executa nem sempre é decisão da UI — backends com template padrão configurado
só precisam do "reabra". Exigir o nome obrigaria toda inbox a chamar `listTemplates?` (opcional!)
antes de conseguir mandar a primeira mensagem.

**`ListDocumentsParams.limit`**: tamanho de página é decisão de quem desenha a lista. Sem ele,
`page` sozinho não define fatia nenhuma e o host acabaria fixando o limite dentro do adapter.

**`getDocumentUrl(uploadId, disposition?)`**: abrir no navegador e baixar são a mesma URL assinada
com `Content-Disposition` diferente, e o carimbo acontece na assinatura — depois de assinada, o
cliente não tem como mudar. A escolha precisa viajar na chamada.

**`exportTranscript?`** (opcional): transcrição completa gerada pelo servidor, ao lado do
`buildTranscriptText` local. A tela costuma ter só a última página de mensagens em memória, e
exportar dali entregaria um recorte parcial com cara de histórico inteiro.

**`formatDateTime` e `isSameDay`** passam a ser exportados. Já eram usados pelas bolhas e pelo
divisor de data; sem exportá-los, cada host mantinha a própria cópia e terminava com timeline e
transcript divergindo no mesmo produto.
