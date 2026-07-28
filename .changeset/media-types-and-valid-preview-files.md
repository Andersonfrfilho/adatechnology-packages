---
'@adatechnology/conversations-ui': minor
---

Biblioteca lista toda mídia, ícone por tipo, e o preview entrega arquivo que abre.

Três defeitos que apareciam juntos ao clicar num anexo:

- **`getDocumentUrl` do mock devolvia sempre o mesmo PNG.** Abrir um PDF entregava um PNG rotulado
  `application/pdf` e o leitor dizia que o arquivo era inválido. Agora cada tipo tem amostra
  legítima (`previewFileSamples`): mídia gerada com ffmpeg e conferida com ffprobe, PDF com
  xref/startxref/`%%EOF`, pacotes Office como zip com as partes obrigatórias. Teste decodifica os
  bytes e checa a assinatura de cada formato — olhar o prefixo da data URL deixaria o bug voltar.
- **A URL era `data:`.** O Chrome bloqueia navegação de topo para `data:` desde a v60, então
  `window.open` dos botões "visualizar"/"baixar" abriria aba em branco mesmo com bytes válidos. O
  preview passou a devolver `blob:`.
- **A biblioteca do preview listava só `document`.** O backend linka as CINCO espécies de mídia
  (`image`, `audio`, `video`, `document`, `sticker`), então foto, vídeo, áudio e sticker apareciam na
  tela real e não no preview. As fixtures agora cobrem todo tipo que a Cloud API aceita, com teste
  que falha se algum sair da lista.

`FileIcon` ganhou imagem, vídeo, áudio, csv e apresentação. Duas regras não óbvias: a **família** do
mimeType é consultada antes do subtipo, senão `audio/mp4` ganharia ícone de vídeo; e o parâmetro
depois do `;` é descartado, porque áudio de WhatsApp chega como `audio/ogg; codecs=opus` e o subtipo
viria `ogg; codecs=opus`.

Novo `createPreviewMediaResolver`: o `MediaRenderer` só busca mídia pela porta `onResolveMediaUrl`, e
o preview não injetava nenhuma — foto, vídeo e áudio ficavam no placeholder para sempre.

A resolução de mídia e a bancada de teste passaram a ser do PACOTE, não de cada host:

- `createMediaUrlResolver(api)` traduz `uploadId`/`mediaId` pelos dois métodos que o contrato já
  declara. E o `MessageBubble` o usa por padrão, tirando do `ConversationsApi` do provider — passar
  `onResolveMediaUrl` virou sobrescrita, não obrigação. Exigir que cada projeto ligasse esse fio só
  garantia que a mídia não carregasse em quem esquecesse, que era o caso de todos.
- `MediaTypesPreview` é a bancada de teste manual, montável em uma linha
  (`<MediaTypesPreview />` — traz store, mock e provider próprios). Ela não passa
  `onResolveMediaUrl` em lugar nenhum de propósito: se a resolução automática quebrar, a tela mostra.
  O que ela pega não é pegável por teste automatizado — "o PDF abre?" depende do leitor do
  navegador, "o vídeo toca?" do decodificador, "a aba abre?" da política do Chrome sobre `data:`.
- `getMediaProxyUrl` do mock também resolve por tipo (`previewFileBase64`). Devolvendo um PNG para
  todo id, vídeo e áudio apareciam quebrados na thread mesmo havendo amostra válida do formato — e
  esse é justamente o caminho da mídia ainda não ingerida.
