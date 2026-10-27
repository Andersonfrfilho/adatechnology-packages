# @adatechnology/product-vision-provider

Identifica produto a partir de uma foto. Dois engines, ambos **locais e gratuitos**: leitor de
código de barras em WebAssembly e embedding CLIP em ONNX. Nenhum serviço a subir, nenhuma chave a
pagar.

Satisfaz a `ProductVisionPort` do `@adatechnology/catalog-module` sem importá-lo — o provider não
conhece quem o consome.

## Instalação

```bash
bun add @adatechnology/product-vision-provider
bun add @undecaf/zbar-wasm          # só se usar o leitor de código de barras
bun add @huggingface/transformers   # só se usar o embedding
```

As duas são `peerDependencies` **opcionais**: a raiz do pacote não carrega engine nenhum, e quem só
quer ler código de barras não baixa runtime de ONNX junto.

## Uso

```ts
import { createVisionChain } from '@adatechnology/product-vision-provider'
import { createBarcodeReader } from '@adatechnology/product-vision-provider/barcode'
import { createClipEmbedder } from '@adatechnology/product-vision-provider/clip-local'

const vision = createVisionChain([createBarcodeReader(), createClipEmbedder()])

createCatalogModule({ db, config, providers: { vision } })
```

## A cadeia funde, não escolhe

É a diferença em relação ao `createTranscriberChain` do `audio-transcription-provider`. Lá os
engines são **alternativas** para a mesma pergunta e o primeiro que responde ganha. Aqui eles
respondem **perguntas diferentes** — um lê o código de barras, o outro produz o vetor — e a leitura
é a soma das duas.

Parar no primeiro que devolvesse `barcode` economizaria a inferência do CLIP e quebraria o caminho
que mais importa: **código lido cujo GTIN ninguém cadastrou**. O consumidor cai para a busca
vetorial exatamente ali, e cairia num vetor que nunca foi gerado.

Um engine vivo basta — leitura parcial é útil. Falha é quando nenhum responde; engolir isso
devolveria "nada encontrado" ao cliente enquanto a causa é infraestrutura fora do ar. Passe
`onEngineFailure` para enxergar a degradação: sem ele, o engine de vetor cair é invisível.

## Decisões que não são configuráveis

**QR Code fica de fora dos formatos aceitos.** Gôndola tem QR de promoção colado ao lado do preço, e
o cliente fotografa a prateleira inteira — decodificar esse QR viraria "código do produto" com a
confiança de um GTIN.

**Símbolo sem dígito não passa por código de barras.** CODE-128 carrega texto livre; entregar
`LOTE-ABC-2026` a uma busca por chave exata gastaria a consulta e responderia "não encontrado" em
vez de deixar a cascata seguir para o vetor.

**Vetor de dimensão inesperada é erro, não aviso.** A coluna do consumidor tem tamanho fixo: deixar
passar adiaria a falha para o `INSERT`, no meio de uma conversa, e um vetor de outro modelo responde
produto errado com toda a confiança.

**O modelo carrega uma vez, não por foto.** Instanciar o pipeline a cada imagem releria os pesos do
disco a cada mensagem — a diferença entre dezenas de milissegundos e vários segundos por chamada.

## Runtime sem decodificador de imagem

O zbar recebe pixels, não um JPEG. O engine usa `createImageBitmap` + `OffscreenCanvas` quando o
runtime os tem; fora deles, injete o seu decoder:

```ts
createBarcodeReader({}, { decodeImage: async (input, maxPixels) => /* sharp, jimp… */ })
```

## Desempate por modelo de visão

Ainda não incluído. A `ProductVisionPort` prevê `rank`, e a cascata do `catalog-module` funciona sem
ele — sem `rank`, os candidatos voltam para a pessoa escolher na conversa. É o único degrau com
custo real de infraestrutura (RAM e latência de CPU), e entra quando a métrica de acerto do vetorial
mostrar que vale a máquina.

## Licença

MIT — Ada Technology.
