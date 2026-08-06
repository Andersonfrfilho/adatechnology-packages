---
'@adatechnology/conversations-ui': minor
---

As duas últimas áreas 🔴 passam a ter tela composta: `FlowsWorkspace` e `MessagesWorkspace`.

O pacote exportava só as peças dessas áreas, e o resultado foi cada produto montando a tela por
conta: o editor de fluxos era uma página de 973 linhas dentro do financiamento mais um fork local dos
componentes, que já estava atrás do pacote. Para o quickcart ter a mesma tela, teria que copiar o
arquivo — a divergência que `pluggable-module.md` §4 proíbe.

**Novo em `/flows`:** `FlowsWorkspace` (a tela), `useFlowsEditor` (o estado, headless),
`FlowEditorCanvas`, `CreateFlowDialog`/`DeleteFlowDialog` e o modelo puro do canvas
(`buildFlowEdges`, `computeMergedLayout`, `countLiveByNode`, `detachedNodeIds`, `newNodeFromSpec`).

**Novo na raiz:** `MessagesWorkspace` e `useMessagesEditor`.

**Labels novos em `FlowEditorLabels`:** `workspace`, `flowManager`, `validation`, `collectionChain`,
`detachedNodeTooltip` e `flowMap.toggleToMap`/`toggleToDetail`. Todos entram no merge profundo, então
um produto que sobrescreva um texto não perde os irmãos dele.

Três defeitos da página original corrigidos na mudança:

- Aresta para destino vazio. `targetsOf` devolve o `default` mesmo em branco, e apagar um nó zera quem
  apontava para ele — a aresta ia para um nó inexistente, o React Flow a descartava em silêncio, e a
  opção parecia ligada sem estar.
- O `offset` por fluxo aberto era ignorado pelo layout mesclado e ainda assim subtraído no fim do
  arraste, gravando posição errada no grafo.
- "Publicado" ficava na barra para sempre, deixando de significar que algo acabou de ser publicado.

`FlowNodeCard` ganhou `isDetached`: card que ninguém aponta fica com contorno tracejado e explica por
quê. Existia só no fork do financiamento.

Também corrigido: `flowEditorOps` importava `CROSS_FLOW_PREFIX` do `meta-whatsapp-contracts` em tempo
de execução quando o próprio `flowGraph` já define a constante. Duas fontes do mesmo prefixo divergem
em silêncio, e o sintoma seria salto entre fluxos que o motor do bot não reconhece.

E o build passou a usar `--clean`: sem isso, `chunk-*.js` de um build anterior sobreviviam no `dist` —
um módulo removido continuaria sendo publicado, e o teste que confere o `dist` passava por artefato
velho.
