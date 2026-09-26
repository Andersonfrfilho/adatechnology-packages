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

O terceiro degrau: só roda quando o código de barras não decidiu e o vetor trouxe **mais de um**
candidato plausível. Servido por um Ollama local — o pacote fala HTTP e não carrega runtime de
modelo, então a RAM e o ciclo de vida são do host.

```ts
import { createOllamaRanker } from '@adatechnology/product-vision-provider/vlm-ollama'

const vision = createVisionChain([createBarcodeReader(), createClipEmbedder()], {
  ranker: createOllamaRanker(),   // sem isto, a cadeia não expõe `rank`
})
```

```bash
ollama pull qwen2.5vl:3b
```

**O modelo escolhe um número, nunca o id do produto.** Pedir o UUID convida a alucinação: o modelo
inventa um id parecido, o consumidor não acha na lista e a escolha se perde. Um número de 0 a N é
verificável em uma linha, e o `0` é "nenhum destes" — a resposta que impede o desempate de escolher
o menos improvável quando o cliente fotografou algo que a loja não vende.

**Um candidato só dispensa o desempate**: gastar a inferência para "confirmar" o único item
transformaria o degrau mais caro da cascata no mais frequente.

### O custo, medido — e onde ele está

Medições em CPU (Apple Silicon, `qwen2.5vl:3b`), imagem sempre nova para não pegar cache de prompt:

| Situação | Tempo | Tokens de visão |
|---|---|---|
| Modelo **frio** (primeira chamada) | **16,3s** | 1104 |
| Quente, foto 1280px | 6,6s | 1632 |
| Quente, foto 896px | 4,6s | 1104 |
| Quente, foto 640px | 4,2s | 1104 |
| Quente, foto 224px | 4,2s | 1104 |

**Quase todo o tempo é prefill da imagem** — a geração da resposta leva ~22ms, porque a resposta são
dois tokens. Daí decorre tudo:

- **`keep_alive` é a maior economia**: 16,3s contra 4,2s. O default do Ollama são 5 minutos, e o
  desempate é esporádico por natureza — sem isto quase toda foto paga o carregamento. O pacote pede
  30 minutos.
- **Encolher a foto para 896px corta ~36%** (6,6s → 4,2s), e é onde o ganho acaba: abaixo disso o
  modelo normaliza para os mesmos 1104 tokens, então 224px leva o mesmo tempo que 640px. Plugue
  `prepareImage` para ativar — o pacote não carrega decodificador de imagem por ninguém.
- **Limitar a saída (`num_predict`) não adianta nada**: ela já são 2 tokens.

**O piso é ~4,2s** nessa classe de máquina com esse modelo. Para ir abaixo: GPU, modelo menor, ou
**não chamar o desempate** — que é a única economia que corta o custo a zero, e por isso o
`catalog-module` pula o desempate quando o vizinho mais próximo vence com folga.

Sem `ranker`, os candidatos voltam para a pessoa escolher, o que é instantâneo.

### Sobre a escolha do modelo

O default é `qwen2.5vl:3b` por ter sido o que respondeu. O `moondream` é menor (1,7GB) e seria a
escolha óbvia, mas devolve **string vazia** no Ollama 0.32 — até com prompt só de texto — e o
sintoma é indistinguível de "o modelo não soube responder".

## Licença

MIT — Ada Technology.
