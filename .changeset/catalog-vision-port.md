---
'@adatechnology/catalog-contracts': minor
---

A porta de identificacao visual de produto, e a leitura que faltava no storage.

`ProductVisionPort` declara o contrato de "foto entra, produto sai", com os tres campos que
decidem a arquitetura: `embeddingModel` declarado pelo provider (a dimensao define a coluna do
indice, e comparar vetores de modelos diferentes responde com produto errado em vez de falhar),
`read` devolvendo `barcode` e `embedding` opcionais (cada engine enxerga uma coisa), e `rank`
opcional, que e o desempate por modelo de visao — sem ele a cascata para no vetorial e quem
escolhe e a pessoa na conversa.

Ausente, a busca por imagem nao existe e o canal segue tratando foto como nao suportada: e a
mesma opcionalidade por ausencia do `metaSync` e do `imageStorage`, agora travada em teste.

`ProductImageStoragePort` ganha `fetch?(key)`, sem o qual nao ha como indexar o catalogo ja
cadastrado: a porta so sabia escrever. E pela chave e nao pela `imageUrl` porque bucket privado
entrega URL assinada de vida curta, e a URL gravada em `products.image_url` meses atras ja
expirou quando a indexacao roda.

O evento `catalog.product_image.unmatched` avisa a foto que nao casou — sem a imagem no payload,
que e conteudo de mensagem de cliente e nao entra em hook de produto.

`VisionDimensionsMismatchError` acompanha o `VisionModelMismatchError`: um cobre o tamanho do
vetor, o outro cobre qual modelo o gerou, e sao falhas de composicao diferentes.
