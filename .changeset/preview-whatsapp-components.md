---
"@adatechnology/conversations-ui": minor
"@adatechnology/meta-whatsapp-contracts": minor
---

Simulador reproduz os componentes do WhatsApp: menu interativo, anexo e áudio.

Mensagem `interactive` deixa de virar texto solto. `MessagePayload` ganha `payload`, o novo
`InteractiveMessage` desenha botões de resposta rápida e lista de opções (com cabeçalho, corpo e
rodapé), e `MessageBubble` aceita `onInteractiveSelect` — ausente, as opções aparecem só de leitura,
que é o certo no histórico da inbox.

No `ConversationPreview` as opções do bot são tocáveis e entregam `button_reply`/`list_reply` no
webhook real, sem atalho. Anexo e gravação de áudio entram por `uploadMedia`, um seam do host: quem
hospeda o arquivo e devolve o `mediaId` é a aplicação, porque o webhook da Meta entrega mídia por
referência e a SDK não inventa um endpoint de upload. Sem `uploadMedia`, os botões não aparecem.

`meta-whatsapp-contracts/testing` ganha `buildInboundMediaPayload` para imagem, vídeo, áudio,
documento e figurinha.

O seletor de emoji ganha busca por palavra-chave em português, com e sem acento, atravessando todas
as categorias.

`DEFAULT_ACCEPTED_FILE_TYPES` passa a ser exportado e a valer exatamente o que a Meta aceita:
imagem, figurinha, áudio, vídeo, PDF, texto, CSV e os documentos do Office nos dois formatos
(Word, Excel e PowerPoint, legado e OpenXML). Formatos que o WhatsApp recusa saíram do seletor —
oferecer `.zip` só empurrava a falha para depois do envio.

O gravador de áudio negocia o formato com o navegador em vez de fixar `webm`, preferindo
`audio/ogg;codecs=opus` e `audio/mp4`, que são os que o WhatsApp aceita.

`ConversationHeader` aceita `extraUtilities`: ações do produto entram como ícone no desktop e item
de menu no celular, junto dos utilitários nativos, preservando o comportamento responsivo que um
slot de `ReactNode` quebraria.
