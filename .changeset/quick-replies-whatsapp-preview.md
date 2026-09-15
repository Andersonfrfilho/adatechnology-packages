---
'@adatechnology/conversations-ui': minor
---

Mensagens prontas ganham barra de formatação (negrito, itálico, tachado, monoespaçado, com Ctrl/Cmd+B e Ctrl/Cmd+I; segue as regras do WhatsApp — espaço fica fora do marcador, cada linha é formatada sozinha, clicar de novo desliga, respeita o limite de 1000 caracteres e o Ctrl+Z nativo) e pré-visualização ao vivo no estilo WhatsApp, com variáveis resolvidas pelo exemplo e anexos listados. O balão foi extraído para `WhatsAppMessagePreview` (exportado) e o `FlowWhatsAppPreview` passou a usá-lo. Novas chaves opcionais em `QuickRepliesWorkspaceLabels`: `formatBold`, `formatItalic`, `formatStrikethrough`, `formatMonospace`, `formattingToolbar`, `previewTitle`, `previewEmptyBody`.
