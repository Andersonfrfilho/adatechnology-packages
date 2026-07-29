---
'@adatechnology/conversations-ui': patch
---

Placeholder de mídia sob demanda deixa de parecer link: botão em pílula com ícone do tipo (imagem, vídeo, play para áudio) em vez de texto azul sublinhado no meio da conversa.

`ConversationContextPanel` ganha `defaultOpen` e rótulo textual de abrir/fechar no cabeçalho — o caret sozinho não indicava que a linha inteira alterna o painel.

Preview rola com `block: 'nearest'`, para não arrastar a página inteira quando o container não tem altura limitada.
