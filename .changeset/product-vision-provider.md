---
'@adatechnology/product-vision-provider': minor
---

Pacote novo: identificar produto por foto, com engines locais e gratuitos.

Leitor de codigo de barras em WebAssembly e embedding CLIP em ONNX, os dois rodando no processo —
sem servico a subir e sem chave a pagar. Ambos sao `peerDependencies` **opcionais** e vivem em
subpath: a raiz do pacote nao carrega engine nenhum, e quem so quer ler codigo de barras nao baixa
runtime de ONNX junto. Ha teste travando isso.

`createVisionChain` **funde** as leituras em vez de parar na primeira, e essa e a diferenca em
relacao ao `createTranscriberChain`: la os engines sao alternativas para a mesma pergunta; aqui um
le o codigo e o outro produz o vetor, e a leitura e a soma. Parar no primeiro `barcode` quebraria o
caminho que mais importa — codigo lido cujo GTIN ninguem cadastrou, que e exatamente onde o
consumidor cai para a busca vetorial.

QR Code fica fora dos formatos aceitos de proposito: gondola tem QR de promocao ao lado do preco, e
o cliente fotografa a prateleira inteira. Simbolo sem digito tambem nao passa por GTIN — CODE-128
carrega texto livre, e `LOTE-ABC-2026` numa busca por chave exata responde "nao encontrado" em vez
de deixar a cascata seguir.

O encaixe com a `ProductVisionPort` do `catalog-module` e teste de compilacao: o contracts entra
como dependencia de desenvolvimento, entao divergencia de forma falha aqui, e nao no host.
