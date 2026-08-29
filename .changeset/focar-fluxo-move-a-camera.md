---
'@adatechnology/conversations-ui': patch
---

Clicar na aba de um fluxo leva a câmera até ele.

`focusFlow` fazia só metade do que o nome promete: trocava o fluxo primário e remesclava o canvas,
mas nunca movia a viewport. A aba acendia, a tela continuava onde estava, e um fluxo posicionado
longe do início ficava fora do campo de visão — em "Consórcio", parado no topo com o fluxo lá
embaixo, clicar parecia não fazer nada.

O clique agora agenda o enquadramento, e um efeito o executa quando os cards daquele fluxo existem
no canvas. A espera não é detalhe: no instante do clique os nós ainda não foram montados, e
enquadrar ali não acharia nada. É a mesma engrenagem que o nó recém-criado já usava.

O `fitView` é restrito aos nós do fluxo clicado. Sem isso ele enquadraria o fecho transitivo
inteiro — que é a visão de sempre, ou seja, o próprio defeito. E `maxZoom` limita a escala, senão um
fluxo de dois nós encheria a tela com dois cards gigantes.
