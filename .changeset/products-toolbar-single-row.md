---
"@adatechnology/products-ui": patch
---

A busca e os dois botões da área de produtos voltam a caber na mesma linha.

O contêiner da busca era `w-full max-w-sm`: `w-full` faz a base do item de flex ser 100% da linha,
e o `max-w-sm` só apara isso em 24rem. Ou seja, ela reservava 384px fixos e não cedia um pixel.
Somados aos 356px dos botões "Importar planilha" e "Novo produto" mais os intervalos, o total batia
em ~740px numa faixa útil de ~736px — estourava por uma dezena de pixels e o `flex-wrap` mandava os
dois botões para a linha de baixo.

Passa a ser `flex-1 min-w-40 max-w-sm`: a busca ocupa a sobra da linha até o mesmo teto de 24rem e
encolhe quando aperta, em vez de empurrar os botões para fora. O `min-w-40` (10rem) é o ponto em que
encolher deixa de valer a pena e a quebra passa a ser a resposta certa — abaixo disso, em celular, os
botões descem de propósito.

O campo de busca também sobe para `min-h-11`. Ele tinha 36px de altura ao lado de botões de 44px:
ficava abaixo da área de toque mínima e desalinhado na linha, o que ajudava a leitura de "quebrado".
