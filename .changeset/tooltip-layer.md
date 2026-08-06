---
"@adatechnology/conversations-ui": minor
---

Novo `TooltipLayer`: um único listener no topo da árvore desenha a dica de qualquer elemento que
carregue o atributo `TOOLTIP_ATTRIBUTE`, também exportado.

O `title` nativo demora ~1s para aparecer, não herda o tema e some no meio do arrasto — em barra de
ícones sem rótulo isso vira adivinhação. Com a camada, todo botão só-ícone do pacote passa a explicar
o que faz, e o host pendura o mesmo atributo nos botões dele sem montar tooltip próprio.

Um listener só, no topo: um componente de tooltip por botão multiplicaria o custo por linha da lista
de conversas.
