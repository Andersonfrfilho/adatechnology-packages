---
'@adatechnology/conversations-ui': patch
---

O canvas do editor de fluxos sai do componente e ganha teste, e o deslocamento por fluxo aberto some.

O `FlowsWorkspace` tinha 1254 linhas, e dentro delas as três funções que decidem o que aparece na
tela: quais arestas existem, onde cada card fica e quantas conversas estão paradas em cada nó. Nenhuma
tinha teste, porque nenhuma dava para chamar sem navegador.

Agora vivem em `flowCanvasModel`, com **24 testes**. Três asserções foram validadas por mutação —
remover o filtro de destino vazio, dar uma coluna por órfão e ler `nodeId` no lugar de `menuNodeId` na
raiz derrubam teste.

**O `offset` por fluxo aberto foi removido.** Ele existia para deslocar um fluxo mesclado no canvas,
mas o layout mesclado — que é justamente o que liga quando há mais de um fluxo aberto — trabalha em
coordenadas absolutas e o ignorava. Sobrava um valor que ninguém usava para desenhar e que ainda era
subtraído ao gravar: a posição que ia para o grafo nunca tinha sido a do card, e o sintoma só aparecia
ao recarregar a tela, com o nó deslocado sozinho. `OpenFlow` virou uma lista de chaves.

As arestas passam a sair do modelo em forma neutra (`FlowEdgeSpec`) e o componente aplica cor e traço.
A separação não é estética: destino errado é invisível até a conversa do cliente parar num nó que não
existe, enquanto cor errada aparece na primeira olhada. O teste cobra o que ninguém vê.

O componente ficou com 1006 linhas. Nenhuma mudança de contrato: `FlowsWorkspaceProps` e
`FlowsWorkspaceApi` seguem iguais, e `FlowLivePosition` passou a ser declarada num lugar só (o
modelo), reexportada pelo workspace.

Verificado com o pacote empacotado nos três produtos: financiamento com `tsc` e `vite build` limpos,
quickcart com zero erros, sakura-bot com os mesmos 7 erros pré-existentes de outra frente e nenhum
ligado a este pacote.
