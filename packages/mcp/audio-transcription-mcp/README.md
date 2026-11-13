# @adatechnology/audio-transcription-mcp

Servidor MCP que expõe transcrição de áudio por Whisper **rodando na própria máquina**: sem chave de API, sem upload, sem custo por minuto. É um invólucro fino sobre o engine local do [`@adatechnology/audio-transcription-provider`](../../backend/audio-transcription-provider).

## Pré-requisitos

Três coisas fora do processo: o binário `whisper-cli` (whisper.cpp), o `ffmpeg` e um modelo ggml no disco.

```bash
brew install whisper-cpp ffmpeg          # macOS
curl -L -o ~/models/ggml-large-v3-turbo.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin
```

Use `large-v3-turbo` (~1.5GB). Modelos menores trocam palavras e entram em loop de repetição em pt-BR — o motivo está detalhado no README do provider.

## Registrar no Claude Code

```bash
claude mcp add ada-transcription -- \
  bunx @adatechnology/audio-transcription-mcp
```

Com as variáveis de ambiente:

| Variável | Obrigatória | Padrão | Para quê |
|---|---|---|---|
| `WHISPER_MODEL_PATH` | ✅ | — | caminho do modelo ggml |
| `WHISPER_BINARY_PATH` | | `whisper-cli` | binário do whisper.cpp |
| `FFMPEG_PATH` | | `ffmpeg` | conversão para WAV 16kHz mono |
| `WHISPER_THREADS` | | do whisper.cpp | threads na inferência |
| `TRANSCRIPTION_LANGUAGE` | | `pt` | idioma padrão |
| `TRANSCRIPTION_ALLOWED_ROOT` | | — | limita a leitura a uma pasta |

**Sobre `TRANSCRIPTION_ALLOWED_ROOT`:** quem escolhe o caminho do arquivo é o modelo, não uma pessoa digitando. Sem essa variável o servidor lê qualquer arquivo que o usuário do processo consiga ler. Aponte para a pasta de áudios e o problema deixa de existir.

## Ferramentas

**`transcribe_audio`** — `{ filePath, languageHint? }` → texto. Caminho absoluto, na máquina que roda o servidor. Aceita m4a, mp3, ogg/opus, wav, flac, webm, amr e aac.

**`check_transcription_setup`** — sem argumentos. Diz qual dos três pré-requisitos falta. Use quando `transcribe_audio` falhar, antes de investigar o áudio.

## Medição

Áudio real de reunião gravado por celular (7min38s, m4a), via MCP de ponta a ponta, Apple M3 Pro com Metal: **23,3s**, 4.964 caracteres, sem loop de repetição. Em CPU de container espere bem mais lento.

## Testes

```bash
bun test
```
