---
'@adatechnology/audio-transcription-mcp': minor
---

Pacote novo: servidor MCP que expõe a transcrição local (whisper.cpp) como ferramenta, sem
chave de API e sem subir o áudio para lugar nenhum.

- `transcribe_audio` — recebe caminho absoluto do áudio e devolve o texto.
- `check_transcription_setup` — diz qual pré-requisito falta (binário, ffmpeg, modelo) em vez de
  deixar a primeira transcrição falhar com erro de processo.

`TRANSCRIPTION_ALLOWED_ROOT` prende os caminhos aceitos a uma pasta: quem escolhe o caminho aqui
é o modelo, não uma pessoa, então a contenção é verificada antes de qualquer leitura.
