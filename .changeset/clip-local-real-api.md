---
'@adatechnology/product-vision-provider': patch
---

Corrige o engine CLIP, que nao conseguia ler imagem nenhuma.

A imagem era passada como `data:` URL. O transformers.js TENTA BUSCAR a URL que recebe, entao toda
foto voltava como `Unable to read image ... (404 Not Found)` — um erro que nao lembra em nada a
causa. O caminho correto e `RawImage.fromBlob`, que decodifica em memoria.

As opcoes `{ pooling: 'mean', normalize: true }` saem: medido contra a biblioteca,
`image-feature-extraction` ignora as duas — o vetor sai identico com e sem elas. Passa-las sugeria
uma garantia que nao existia.

O vetor passa a ser normalizado explicitamente. O CLIP entrega norma ~11, e o indice do consumidor
compara por cosseno, que normaliza sozinho — a busca funcionaria de qualquer jeito. Normalizar
mesmo assim porque a garantia passa a valer para distancia euclidiana e produto interno, e vetor de
norma arbitraria no indice e armadilha para o proximo que escolher outro operador.

O carregamento da peer ganha a mesma segunda tentativa que o leitor de codigo de barras recebeu: o
`import` dinamico resolve a partir DESTE pacote, e gerenciador que instala por link deixa a peer no
consumidor.

Entra teste de integracao com inferencia real: dimensao, vetores diferentes para imagens diferentes
(um `read` que devolvesse sempre o mesmo vetor passaria no teste de dimensao) e norma unitaria.
