# CLAUDE.md — @adatechnology/audio-transcription-mcp

Servidor MCP (stdio) sobre o engine local do `@adatechnology/audio-transcription-provider`. Duas ferramentas: `transcribe_audio` e `check_transcription_setup`.

## O que um agente precisa saber para não errar

- **`filePath` é absoluto e é da máquina do servidor**, não do cliente. Caminho relativo é recusado de propósito: não existe cwd compartilhado entre cliente e servidor MCP.
- **A transcrição é síncrona e demora.** Ordem de grandeza: ~25s para 7 minutos de áudio em GPU de laptop, bem mais em CPU de container. Não é travamento.
- **Áudio sem fala devolve `(áudio sem fala detectável)`**, não string vazia — string vazia deixaria o cliente sem saber se transcreveu nada ou se a ferramenta quebrou.
- **Falhou? Chame `check_transcription_setup` antes de investigar o áudio.** Três dependências externas (whisper.cpp, ffmpeg, modelo ggml) e a mensagem de subprocesso não diz qual faltou.
- **O texto já vem sem loop de repetição** — o provider aplica `collapseRepetitions`. Não pós-processe de novo.

## Armadilhas de implementação

- **Nada além do protocolo pode ir para o stdout.** O transporte é stdio: um `console.log` corrompe a sessão. Diagnóstico vai para stderr (`main.ts`).
- **`whisper-cli --version` não é teste de existência.** Ele inicializa o backend de GPU antes de responder (8,4s no Metal) e sai com código não-zero. Só `ENOENT` significa ausência — qualquer outra falha significa que o binário está lá.
- **Contenção de caminho compara depois de `resolve`**, e com `sep` no fim: sem isso `../` passa e `/audios-privados` casa com a raiz `/audios`. Há teste para os dois casos.
- **Configuração é validada no boot** (`parseEnvironment`), com a variável faltante nomeada na mensagem. Um servidor MCP mal configurado falha em silêncio no cliente; este falha ao iniciar.
