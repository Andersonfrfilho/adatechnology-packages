---
"@adatechnology/conversations-ui": minor
---

Torna traduzíveis as últimas strings fixas dos componentes de conversa.

`Avatar`, `Lightbox`, `ConversationListItem`, `MessageComposer` e `WhatsAppMessageEditor` passam a aceitar `labels` opcional (`Partial<...Labels>`), no mesmo padrão dos demais componentes: cada um exporta seu tipo `...Labels` e um `DEFAULT_..._LABELS` em português, então quem não passa nada continua vendo exatamente o texto de hoje.

`WhatsAppCreateTemplateForm` ganha `namePlaceholder` no bag de labels que já existia.
