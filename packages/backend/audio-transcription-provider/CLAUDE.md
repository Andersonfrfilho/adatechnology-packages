# CLAUDE.md — @adatechnology/audio-transcription-provider

Speech-to-text para produtos conversacionais. Engine hospedado (Groq/Whisper) por padrão, engine local (whisper.cpp) opt-in, cadeia para encadear os dois.

Standalone: não depende de `@adatechnology/meta-whatsapp-*`. O que atravessa a fronteira é `{ buffer, mimeType }` — qualquer canal serve.

> O README cobre instalação, limites de cota do Groq e o Dockerfile do engine local. Este arquivo é o que um agente precisa para **integrar sem errar**: qual entrada usar, o que o pacote garante e onde estão as armadilhas.

## Regra de decisão — qual entrada usar

| Situação | Use |
|---|---|
| Transcrição hospedada, caso normal | `createGroqTranscriber({ apiKey })` |
| Precisa de reserva quando o Groq cai ou recusa o codec | `createTranscriberChain([groq, local])` |
| Não pode enviar áudio para fora, ou cota apertada | `createWhisperLocalTranscriber` do subpath `/whisper-local` |
| Host quer decidir entre reenfileirar e encerrar | `isRetriableTranscriptionFailure(error)` |
| Host quer só "transcreveu ou não" | `try/catch` na borda devolvendo `undefined` — ver padrão B |

## Superfície da API

```ts
type AudioTranscriber = Readonly<{
  name: string
  transcribe: (input: TranscriptionInput) => Promise<TranscriptionResult>
}>

type TranscriptionInput = Readonly<{
  buffer: Buffer
  mimeType: string          // aceita `audio/ogg; codecs=opus` — o pacote normaliza
  languageHint?: string     // ISO 639-1; padrão 'pt'
}>

type TranscriptionResult = Readonly<{
  text: string              // já vem com trim
  language?: string         // quando o engine informa
  durationSeconds?: number
  engine: string            // 'groq' | 'whisper-local' | 'chain(a>b)'
}>
```

`createGroqTranscriber(config)` — `apiKey` obrigatória (lança `TranscriptionError` se vazia). Opcionais com padrão: `model` (`whisper-large-v3-turbo`), `baseUrl`, `languageHint` (`pt`), `maxBytes` (25MB), `timeoutMs` (**120_000**), `fetchImplementation`.

`createTranscriberChain(transcribers, { onEngineFailure })` — lança se a lista for vazia; com um engine só devolve o próprio, sem envolver.

`createWhisperLocalTranscriber(config)` — `modelPath` obrigatório. Opcionais: `binaryPath` (`whisper-cli`), `ffmpegPath` (`ffmpeg`), `threads`, `languageHint`, `timeoutMs` (**600_000**).

## Erros — a distinção que o pacote existe para carimbar

`TranscriptionError` carrega `engine`, `isRetriable` e `cause`. Duas subclasses: `TranscriptionRateLimitError` (com `retryAfterSeconds`) e `TranscriptionUnsupportedError` (com `mimeType`).

| Causa | `isRetriable` | Host deve |
|---|---|---|
| 429 (cota) | `true` | reenfileirar respeitando `retryAfterSeconds` |
| 5xx, 408, 409, rede, timeout | `true` | reenfileirar com backoff |
| resposta sem campo `text` | `true` | reenfileirar |
| 400/415, mime fora da tabela | `false` | encerrar — retry não conserta codec |
| chave inválida, >`maxBytes`, áudio vazio | `false` | encerrar e alertar |

`isRetriableTranscriptionFailure(error)` responde por qualquer valor: **erro desconhecido conta como retriável**, porque falha de rede é o caso comum e insistir é barato.

## O que o pacote garante (não reimplemente)

- **Nunca lê `process.env`.** Chave e config entram por parâmetro. Quem valida ambiente é o host.
- **Tabela mime→extensão é allowlist do que o Groq aceita**, não um mapa best-effort. O serviço escolhe o decoder pelo **sufixo do nome do arquivo** no multipart, não pelo Content-Type — mandar `blob` sem extensão faz um OGG válido voltar 400. Mime fora da tabela vira `TranscriptionUnsupportedError` **antes da rede**.
- **AMR e AAC estão fora de propósito** — o Groq realmente não aceita. A cadeia repassa ao engine local, que converte com ffmpeg. Não "conserte" isso com fallback para `ogg`: gera 400 silencioso.
- **Áudio vazio ou acima de `maxBytes` é barrado localmente** — a requisição voltaria erro e ainda contaria no rate limit.
- **`temperature: 0`** — sem isso, uma retentativa produz transcrição divergente da primeira.
- **`text` vazio é resultado legítimo**, não falha: áudio em silêncio transcreve para nada. Marcar como erro faria o host reprocessar o mesmo silêncio para sempre.
- **Cópia explícita do buffer** antes do `Blob`: um `Buffer` do Node costuma ser view sobre pool compartilhado, e passar `.buffer` levaria bytes de outros arquivos no multipart.
- **A cadeia tenta o próximo engine até em erro definitivo** (suporte a codec varia) e, se todos falharem, propaga o **primeiro erro retriável** — não o último. Um áudio que só esbarrou na cota do engine 1 não pode ser marcado como perdido pelo definitivo do engine 2.

## Armadilhas de integração

1. **`timeoutMs` padrão é 120s.** Serve a transcrição em background. Em caminho com usuário esperando resposta, passe algo na casa de 15s — o padrão trava a conversa.
2. **`/whisper-local` exige import dinâmico** se o fallback for desligável por env. O subpath carrega `node:child_process` e pressupõe ffmpeg + whisper.cpp + modelo ggml na imagem; import no topo arrasta essa bagagem mesmo com a reserva desligada, que é o padrão.
3. **`createGroqTranscriber` lança na construção** com `apiKey` vazia. Guarde a checagem de chave no host antes de construir.
4. **Não instancie por job.** O factory é barato mas a config é estável — memoize no módulo.
5. **Testes não precisam de rede**: injete `fetchImplementation`. E como `AudioTranscriber` é estrutural, um mock `{ name, transcribe }` serve sem importar o pacote.

## Padrões de consumo em produção (quickcart)

**A — transcrição persistida, exibida na inbox** (`apps/worker-quickcart/src/infra/transcription/transcriberAdapter.ts`): resolve o transcriber memoizado, devolve `undefined` quando desligado ou sem chave (a ingestão grava colunas nulas — "não avaliado" — em vez de fingir que tentou). Erros **sobem** para o job decidir reenfileirar pelo `isRetriable`.

**B — STT efêmero que alimenta o motor de conversa** (`apps/worker-quickcart/src/modules/stt/infra/providers/GroqSttProvider.ts`): mesmo `createGroqTranscriber`, com `timeoutMs` curto, e um `catch` na borda que engole tudo devolvendo `undefined` — o contrato `SttProvider` não tem como expressar "tente de novo", e a fila já reentrega. O `isRetriable` vai para o log, onde serve a diagnóstico.

Os dois casos usam chaves de ambiente **separadas** (`TRANSCRIPTION_GROQ_API_KEY` e `GROQ_API_KEY`), então a mesma conta Groq aparece em duas variáveis de deploy.

## Estrutura

```
src/
├── audio-transcription.types.ts      # portas e configs
├── audio-transcription.constant.ts   # tabela de mimes, padrões, normalizeMimeType
├── audio-transcription.error.ts      # TranscriptionError + isRetriable
├── groq-transcriber.service.ts       # engine hospedado (só fetch/FormData/Blob)
├── transcriber-chain.service.ts      # encadeamento
├── whisper-local/                    # subpath separado — child_process, ffmpeg
└── index.ts                          # barril público
```

```bash
bun test          # suíte inteira sem rede
bun run check     # tsc --noEmit
bun run build     # tsup
```
