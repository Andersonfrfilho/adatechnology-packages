---
'@adatechnology/conversations-ui': minor
---

Mensagens prontas ganham barra de formatação (negrito, itálico, tachado, monoespaçado, com Ctrl/Cmd+B e Ctrl/Cmd+I) e pré-visualização ao vivo no estilo WhatsApp, com variáveis resolvidas pelo exemplo e anexos listados. O balão foi extraído para `WhatsAppMessagePreview` (exportado) e o `FlowWhatsAppPreview` passou a usá-lo. Novas chaves opcionais em `QuickRepliesWorkspaceLabels`: `formatBold`, `formatItalic`, `formatStrikethrough`, `formatMonospace`, `formattingToolbar`, `previewTitle`, `previewEmptyBody`.
