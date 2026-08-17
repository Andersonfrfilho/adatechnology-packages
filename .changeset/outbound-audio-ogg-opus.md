---
'@adatechnology/meta-whatsapp-provider': minor
'@adatechnology/meta-graph-core': minor
---

Áudio de saída vai para o WhatsApp em ogg/opus, qualquer que seja o gravador.

O `MediaRecorder` do Chrome anuncia `audio/mp4` e entrega um MP4 com brand `isom`. É um MP4
válido, toca em qualquer player — mas o processamento da Meta o classifica como
`application/octet-stream` e recusa a mensagem com o erro **131053 Media upload error**. O envio
retorna 200 com `wamid`, e a falha só aparece depois, no webhook de status: para quem está na
inbox, o áudio simplesmente não chega no celular do cliente.

`sendMedia` agora normaliza o áudio antes do upload:

- **decide pelos bytes, não pelo mimeType declarado.** `detectAudioContainer` lê a assinatura do
  arquivo, porque o mimeType descreve a intenção do gravador e não o que saiu dele — confiar nele
  é exatamente o que deixava o `isom` passar;
- **distingue MP4 de áudio de MP4 genérico pelo brand** (`M4A `/`mp42`/`mp41` passam; `isom` não);
- **converte para ogg/opus** o que não estiver em container aceito — inclui `audio/webm`, que
  nenhum navegador consegue entregar num formato que o WhatsApp aceite. Além de aceito, ogg/opus
  é o formato que o WhatsApp renderiza como mensagem de voz;
- **falha alto** com `WhatsAppAudioTranscodeError` quando o ffmpeg não está disponível, em vez de
  enviar um arquivo que será recusado lá na frente.

A conversão usa ffmpeg por pipe (sem arquivo temporário), com timeout de 30s. O caminho do
binário vem de `FFMPEG_PATH` ou do construtor; o transcodificador é injetável, então o teste roda
sem ffmpeg instalado. **Quem consome precisa de ffmpeg na imagem** — sem ele, envio de áudio
gravado no navegador passa a estourar erro claro no lugar de sumir em silêncio.

Verificado com o arquivo real recusado em produção: 59.728 bytes `mp4-generic` → 14.956 bytes
`ogg` (opus, 48 kHz, mono).
