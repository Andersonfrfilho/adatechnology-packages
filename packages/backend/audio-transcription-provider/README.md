# @adatechnology/audio-transcription-provider

Speech-to-text para produtos conversacionais. Engine hospedado (Groq/Whisper) por padrão, engine local (whisper.cpp) como opt-in, e uma cadeia para encadear os dois.

Pacote **standalone**: não depende de `@adatechnology/meta-whatsapp-*`. O que atravessa a fronteira é um buffer de áudio e um mime — qualquer canal serve.

## Instalação

```bash
pnpm add @adatechnology/audio-transcription-provider
```

O engine padrão não tem dependências: usa `fetch`, `FormData` e `Blob` globais (Node 18+, Bun).

## Uso

```ts
import { createGroqTranscriber } from '@adatechnology/audio-transcription-provider'

const transcriber = createGroqTranscriber({ apiKey: environment.GROQ_API_KEY })

const { text, language, durationSeconds } = await transcriber.transcribe({
  buffer: audioBuffer,
  mimeType: 'audio/ogg; codecs=opus',
})
```

O pacote nunca lê `process.env` — a chave entra por parâmetro, como todo o resto do monorepo.

## Cadeia de engines

Adicionar um engine de reserva é configuração, não refactor:

```ts
import { createGroqTranscriber, createTranscriberChain } from '@adatechnology/audio-transcription-provider'
import { createWhisperLocalTranscriber } from '@adatechnology/audio-transcription-provider/whisper-local'

const transcriber = createTranscriberChain(
  [
    createGroqTranscriber({ apiKey: environment.GROQ_API_KEY }),
    createWhisperLocalTranscriber({ modelPath: '/models/ggml-small.bin' }),
  ],
  { onEngineFailure: (error, { engine }) => logger.warn('transcrição degradou', { engine, error }) },
)
```

A cadeia tenta o próximo engine **mesmo em erro definitivo**, porque suporte a codec varia: o Groq recusa AMR, e o engine local com ffmpeg na frente converte AMR sem reclamar.

## Erros: retriável vs. definitivo

A distinção que importa para quem consome é `isRetriable`.

| Erro | `isRetriable` | O que fazer |
|---|---|---|
| `TranscriptionRateLimitError` | `true` | Reenfileirar respeitando `retryAfterSeconds` |
| `TranscriptionError` (5xx, rede, timeout) | `true` | Reenfileirar com backoff |
| `TranscriptionUnsupportedError` | `false` | Encerrar — nenhum retry conserta codec |
| `TranscriptionError` (401, arquivo grande, áudio vazio) | `false` | Encerrar e alertar |

Estourar cota é espera; codec desconhecido é definitivo. Sem essa distinção, quem consome só sabe "não transcreveu" e escolhe entre desistir de um áudio que funcionaria em dez minutos ou reprocessar para sempre um formato impossível.

## Limites do engine hospedado (Groq)

| | Free tier | Dev tier |
|---|---|---|
| Requisições/min | 20 | maior |
| Requisições/dia | 2.000 | maior |
| Segundos de áudio/hora | 7.200 | maior |
| Segundos de áudio/dia | 28.800 | maior |
| Tamanho máximo | 25MB | 100MB |

Nota de voz do WhatsApp não passa de 16MB, então o teto de tamanho não encosta. A cobrança tem **piso de 10 segundos por requisição** — cem áudios de 2s custam o mesmo que cem de 10s.

Formatos aceitos: `flac`, `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `ogg`, `wav`, `webm`. OGG/Opus — o que a Meta entrega — vai direto, sem conversão.

## Engine local (opt-in)

Importado de `@adatechnology/audio-transcription-provider/whisper-local`, subpath separado para que quem usa só o hospedado não carregue `node:child_process` nem a exigência de binários na imagem.

Exige na imagem: `ffmpeg` (o whisper.cpp só lê WAV PCM 16kHz mono) e o binário `whisper-cli` mais um modelo ggml. O trecho de Dockerfile Alpine está no cabeçalho de [`whisper-local.service.ts`](src/whisper-local/whisper-local.service.ts).

O modelo `small` (~488MB) é o menor que transcreve pt-BR de forma utilizável; `base` (~148MB) erra demais em áudio de celular para valer a economia.

## Testes

```bash
bun test
```

`fetchImplementation` é injetável — a suíte do engine hospedado roda inteira sem rede.
