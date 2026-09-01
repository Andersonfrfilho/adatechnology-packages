---
'@adatechnology/catalog-module': minor
'@adatechnology/catalog-image-storage-provider': minor
---

Indexacao das imagens ja cadastradas, e a leitura de bucket que ela precisa.

Sem esta varredura o indice nasce vazio e a busca por foto responde "nao encontrei" para o catalogo
inteiro — o modo de falha mais silencioso da capacidade, porque nada quebra.

`IndexProductImagesUseCase` pagina por `id` e nao por `offset`: a varredura roda sobre a base
inteira, e com offset uma linha inserida no meio desloca a janela e pula produtos sem sinal nenhum.
Uma imagem sumida do bucket conta como falha e a varredura segue; abortar no primeiro problema
deixaria o resto da base sem indice.

`createS3ProductImageStorage` implementa o `fetch` da porta, entao nenhum produto escreve acesso a
bucket para indexar. A leitura e pela chave mesmo aqui, onde a URL e publica: a URL e detalhe de
entrega — muda com CDN, dominio ou migracao de bucket — e buscar por HTTP sairia do processo para
voltar ao mesmo bucket, pagando uma volta pela internet por produto.
