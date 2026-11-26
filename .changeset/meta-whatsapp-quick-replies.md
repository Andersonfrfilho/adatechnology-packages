---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/conversations-ui': minor
---

Respostas rápidas por empresa no módulo do WhatsApp (só texto). Contracts: `whatsAppQuickReplyInputSchema`, `listWhatsAppQuickRepliesQuerySchema`, `WhatsAppQuickReply`, `QUICK_REPLY_LIMITS` (título 40, atalho 20, texto 1000, 500 por empresa), `QUICK_REPLY_SHORTCUT_PATTERN` e os erros `QuickReplyNotFoundError`, `QuickReplyShortcutTakenError` (código `QUICK_REPLY_SHORTCUT_TAKEN`, o que o `QuickRepliesWorkspace` reconhece) e `QuickReplyLimitReachedError`. Módulo: tabela `meta_whatsapp.quick_replies` (migration aditiva nos dois layouts, v1 e journal; atalho único por empresa), `module.quickReplies.{list,create,update,delete}` e `createMetaWhatsAppQuickReplyRoutes({ module, scopes? })` pelo `module-http` (`GET`/`POST /quick-replies`, `PUT`/`DELETE /quick-replies/:id`; leitura para agente autenticado, escrita exige `quick-replies:write`). O módulo passa a depender de `@adatechnology/module-http`. conversations-ui: `createMetaWhatsAppQuickRepliesClient`, que satisfaz a porta de respostas rápidas (`listQuickReplies`, `createQuickReply`, `updateQuickReply`, `deleteQuickReply`) a partir dessas rotas.
