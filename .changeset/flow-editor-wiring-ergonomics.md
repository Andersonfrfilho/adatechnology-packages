---
'@adatechnology/conversations-ui': patch
---

Editor de fluxo: montar a conversa deixou de ser trabalho de precisão.

**O card não desaparece mais ao desligar um fio.** Era layout, não dado. Nó vindo de seed não tem
`position`, então quem manda nele é o auto-layout — e o auto-layout joga todo nó sem ligação de
entrada para uma faixa abaixo de tudo. Desligar a última ação ("encaminhar para atendimento") a
mandava para fora da área visível no mesmo instante, o que se lê como "o editor apagou meu card". O
canvas com fluxos mesclados já tinha essa proteção; o de fluxo único, não.

**Ação de envio de material agora tem saída.** `send_media` era desenhada como terminal, mas o motor
do bot *anda* para o `next` depois dela — então o editor era o único impedimento para mandar o
material e seguir para o atendimento. `PASS_THROUGH_ACTION_KINDS` marca quais ações continuam o
fluxo; as terminais (handoff, encerrar) seguem sem saída, porque desenhar fio que o motor ignora
deixaria a conversa parada em produção sem sintoma no editor.

**"+" em cada saída** cria o próximo nó já conectado, numa única edição (desfazer não deixa card
solto). Ele fica **sempre visível**, esmaecido: quando aparecia só no hover, o ponteiro atravessava o
vão entre a linha e o botão, o hover caía e o alvo fugia do mouse. O nó novo nasce à direita de quem
o criou e **desce se aquele lugar já tiver dono** — tipicamente o nó que acabou de ficar solto, que
de outro modo ficava sob o novo.

**"✕" no fio, ao passar o mouse**, para desligar. Não havia caminho nenhum: as arestas são derivadas
do grafo a cada render, então clicar e apertar Delete não tem onde guardar seleção, e trocar um
destino passava por apagar o card e refazê-lo. Desligar grava destino vazio e **preserva a opção**,
senão sumiria junto o botão que o cliente vê no WhatsApp. **Arrastar a ponta do fio** para outro card
religa em uma edição.

**Layout em cascata, um card por linha.** O auto-layout empilhava por camada: todos do mesmo nível
na mesma coluna, e todas as colunas começando na mesma altura. Isso deixava os fios correndo na
horizontal — e fio horizontal passa **por trás** de qualquer card entre a origem e o destino, que era
o que tornava o desenho ilegível. Agora cada card avança uma coluna à direita e desce um degrau, com
o degrau igual à altura real do card de cima. Toda ligação vira diagonal curta e visível, e a
travessia é em profundidade (não em largura) para que um caminho de conversa saia inteiro antes do
próximo começar, em vez dos ramos de uma decisão se intercalarem linha a linha.

**O laço no próprio card virou ícone, e deixou de ser aresta.** Um `next` apontando para o próprio
nó ("repete a pergunta") não tem trajeto para desenhar: origem e destino são o mesmo retângulo. Como
fio ele não tinha onde caber — por baixo sumia atrás do card, por cima o cobria. Agora a saída que
volta ao próprio nó não gera aresta nenhuma; quem mostra o comportamento é um ícone de repetição na
própria linha de saída, dentro do card. O comportamento existia desde sempre e era invisível.

**Legenda do canvas.** O editor distinguia seis tipos de ligação só por cor e traço, e nada dizia o
que era o quê — cor sem chave não informa, decora. O painel lê as *mesmas* constantes que pintam as
arestas, para a chave não poder divergir do desenho. Recolhido por padrão: em canvas cheio uma caixa
fixa cobre card, então quem já conhece o vocabulário não paga o espaço.

**O alerta do card agora aponta o card certo, e diz o que é.** O ícone de erro/aviso olhava os
problemas do *fluxo inteiro*, sem filtrar pelo nó: um problema em qualquer lugar acendia o alerta em
**todos** os cards, e o ícone deixava de apontar coisa alguma. Agora acende só no nó que tem o
problema, e o tooltip lista quais são — antes era preciso abrir o painel de cada card procurando.

**Dica em ícone voltou a funcionar.** A camada de dicas exigia `HTMLElement`, e ícone é `<svg>`, que
não é. Além de a dica do ícone nunca aparecer, ela *engolia* a do card ao redor: o `closest` parava
no svg e a busca não continuava para cima. Agora aceita qualquer `Element`.

**Pontos de ligação de 6px para 14px**, com anel de contraste. O ponto antigo somia na borda do card
e não se lia como "puxe daqui".

Novidades de API: labels em `quickAdd` (`fromHandle`, `title`, `disconnect`), exports
`FlowPaletteMenu`, `flowEdgeTypes`/`FlowConnectionEdge`, `PASS_THROUGH_ACTION_KINDS`, `findFreeSlot`, `cascadeOrder`, `LAYOUT_COLUMN_GAP`, `LAYOUT_ROW_GAP` e
`FlowLegend`, mais labels em `legendPanel`.
O "+" é capacidade por ausência: sem `onQuickAdd`, o `FlowNodeCard` não desenha o affordance.
