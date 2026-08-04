---
'@adatechnology/conversations-ui': minor
---

O cliente do simulador (`createPreviewWebhookClient` e, quando sabe a rota,
`createPreviewBridgeClient`) passa a expor `uploadMedia`, e o `ConversationPreview` usa isso quando o
host não passa nada — o microfone aparece sem wiring por produto. `uploadMedia` como prop continua
válido, para quem quer outro destino.
