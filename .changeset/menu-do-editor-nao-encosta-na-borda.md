---
'@adatechnology/conversations-ui': patch
---

Os menus do editor de fluxo deixam de ficar presos contra a borda da tela.

O menu do "+" era posicionado na coordenada crua do clique, e os submenus ("Pergunta", "Ação") em
`absolute left-full top-0` — sempre à direita do item e alinhados ao topo. Nenhum dos dois consultava
o tamanho da janela. Card perto da borda direita jogava o menu para fora; item de ação perto do
rodapé cortava a lista no meio, e sem rolagem os últimos itens ficavam inalcançáveis: o menu ficava
preso contra a borda, sem caminho para o resto.

A decisão de onde o painel cabe virou função pura (`placeFloatingPanel`): ela vira o submenu para a
esquerda quando não há espaço à direita, sobe o painel quando ele vazaria pelo rodapé, e devolve um
teto de altura para o painel rolar por dentro em vez de ser cortado. É ela que decide se o operador
alcança a opção, e testá-la exige apenas números.

Os dois menus passaram a `fixed` posicionado por medição, feita antes da pintura — não há salto.
