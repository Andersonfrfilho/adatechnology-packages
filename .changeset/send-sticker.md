---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-provider': minor
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/conversations-ui': patch
---

Figurinha (sticker) no WhatsApp: `sendMedia({ asSticker: true })` envia como `type: 'sticker'` (exige `image/webp`), e `createSendStickerAction` (`send_sticker`) deixa o host mandar uma figurinha a partir de um resolvedor. O painel mostra figurinha sem cortar.
