---
'@adatechnology/conversations-ui': patch
---

Editor de fluxos: dois defeitos silenciosos, e as operações de grafo passam a ter teste.

A tela composta chegou na #30. O que faltava era prova: a área de maior risco do pacote — as decisões
que dizem para onde a conversa do cliente vai — não tinha nenhum teste, e duas delas estavam erradas.

**Aresta para destino vazio.** Apagar um nó zera o destino de quem apontava para ele, e `targetsOf`
devolve o `default` mesmo em branco. A tela emitia a aresta, o React Flow a descartava em silêncio, e
a opção **parecia ligada sem estar** — a conversa para ali e quem editou não vê nada de errado.

**Posição gravada errada ao arrastar.** Com mais de um fluxo aberto o layout mesclado posiciona tudo
em coordenadas absolutas e ignora o `offset`, mas o fim do arraste subtraía ele de qualquer forma. O
grafo recebia uma posição que nunca foi a do card, e o sintoma só aparecia ao recarregar: nó deslocado
sozinho.

**As operações agora vêm de `flowEditorOps`, com 23 testes.** `resolveConnection` (traduzir o arraste,
e recusar salto para o meio de outro fluxo, que o motor do bot ignora), `applyConnection`,
`removeNodeAndCleanRefs`, `mergedFlowKeysFrom` (fecho transitivo por BFS — fluxo que volta a si mesmo é
o caso mais comum que existe) e os ids do canvas mesclado. Saíram do corpo da tela, onde não davam
para testar sem navegador. Três asserções foram validadas por mutação.

Também: `--clean` no build. Sem isso, `chunk-*.js` de um build anterior sobreviviam no `dist` — um
módulo removido continuaria sendo publicado. Achado por `buildOutput.test.ts`, o único teste que lê o
`dist`, que existe porque um pacote irmão já saiu com 19 testes verdes e sem renderizar.
