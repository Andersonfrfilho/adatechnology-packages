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

A chave do indice e `(produto, modelo, origem)` e nao `(produto, modelo)`: um produto guarda o vetor
da foto de estudio e os das fotos reais que clientes mandaram e alguem confirmou. Sem a origem na
chave, gravar o aprendizado do feedback sobrescreveria a foto de catalogo — a especializacao viraria
substituicao.

Isso obriga a busca a deduplicar por produto: com varios vetores do mesmo item, os N mais proximos
podem ser todos dele, e a conversa mostraria o mesmo produto quatro vezes. A deduplicacao e em
memoria sobre uma busca com folga, e nao `DISTINCT ON`, porque `DISTINCT ON` exigiria ordenar por
`product_id` antes da distancia — e e a ordem por distancia que faz o planejador usar o indice HNSW.
